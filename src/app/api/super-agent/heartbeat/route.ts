import type { NextRequest } from 'next/server';
import { and, asc, eq, lte } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/libs/DB';
import { authFailureResponse, getRequestAuth, isAuthFailure, requireApiKeyScope } from '@/libs/ApiKeys';
import { buildSuperAgentHeartbeatMessage, getNextHeartbeatAt } from '@/libs/SuperAgent';
import { agentJobsSchema, conversationsSchema, conversationSuperAgentsSchema, messagesSchema } from '@/models/Schema';

export const runtime = 'nodejs';

const triggerSchema = z.object({
  conversationId: z.string().uuid().optional(),
  force: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

type SerializableMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: unknown;
};

type TriggerTarget = {
  conversationId: string;
  userId: string;
  model: string;
  wakePrompt: string;
  heartbeatMinutes: number;
};

function parseMessageContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

async function loadConversationMessages(conversationId: string): Promise<SerializableMessage[]> {
  const messages = await db
    .select({
      role: messagesSchema.role,
      content: messagesSchema.content,
    })
    .from(messagesSchema)
    .where(eq(messagesSchema.conversationId, conversationId))
    .orderBy(messagesSchema.createdAt);

  return messages
    .filter(message => ['user', 'assistant', 'system', 'tool'].includes(message.role))
    .map(message => ({
      role: message.role as SerializableMessage['role'],
      content: parseMessageContent(message.content),
    }));
}

async function triggerConversationRun(req: NextRequest, target: TriggerTarget, secret: string) {
  const now = new Date();
  const [runningJob] = await db
    .select({ id: agentJobsSchema.id })
    .from(agentJobsSchema)
    .where(and(
      eq(agentJobsSchema.conversationId, target.conversationId),
      eq(agentJobsSchema.status, 'running'),
    ))
    .limit(1);

  if (runningJob) {
    await db
      .update(conversationSuperAgentsSchema)
      .set({
        nextHeartbeatAt: getNextHeartbeatAt(target.heartbeatMinutes, now),
        lastRunStatus: 'skipped_running',
        updatedAt: now,
      })
      .where(eq(conversationSuperAgentsSchema.conversationId, target.conversationId));

    return { conversationId: target.conversationId, status: 'skipped_running', jobId: runningJob.id };
  }

  const heartbeatText = buildSuperAgentHeartbeatMessage(target.wakePrompt, now);
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const historyMessages = await loadConversationMessages(target.conversationId);

  await db.insert(messagesSchema).values({
    id: userMessageId,
    conversationId: target.conversationId,
    role: 'user',
    content: heartbeatText,
  });
  await db
    .update(conversationsSchema)
    .set({ updatedAt: now })
    .where(eq(conversationsSchema.id, target.conversationId));
  await db
    .update(conversationSuperAgentsSchema)
    .set({
      lastHeartbeatAt: now,
      nextHeartbeatAt: getNextHeartbeatAt(target.heartbeatMinutes, now),
      lastRunStatus: 'running',
      updatedAt: now,
    })
    .where(eq(conversationSuperAgentsSchema.conversationId, target.conversationId));

  void historyMessages;
  void target.model;

  const res = await fetch(new URL('/api/super-agent/chat', req.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ona-heartbeat-secret': secret,
    },
    body: JSON.stringify({
      conversationId: target.conversationId,
      message: heartbeatText,
      assistantMessageId,
    }),
  });

  const payload = await res.text();
  void jobId;

  const finalStatus = !res.ok || payload.includes('"type":"error"') ? 'error' : 'idle';
  await db
    .update(conversationSuperAgentsSchema)
    .set({
      lastRunStatus: finalStatus,
      updatedAt: new Date(),
    })
    .where(eq(conversationSuperAgentsSchema.conversationId, target.conversationId));

  return { conversationId: target.conversationId, status: finalStatus, jobId };
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const parsed = triggerSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map(issue => issue.message).join('; ') }, { status: 400 });
  }

  const secret = process.env.SUPER_AGENT_HEARTBEAT_SECRET;
  const isInternalHeartbeatRequest = Boolean(secret && req.headers.get('x-ona-heartbeat-secret') === secret);
  const { conversationId, force = false, limit = 1 } = parsed.data;

  let authUserId: string | null = null;
  if (!isInternalHeartbeatRequest) {
    const auth = await getRequestAuth(req);
    if (isAuthFailure(auth)) return authFailureResponse(auth);
    if (!auth) return Response.json({ error: 'Authentication required.' }, { status: 401 });
    const scopeFailure = requireApiKeyScope(auth, 'task_running');
    if (scopeFailure) return authFailureResponse(scopeFailure);
    authUserId = auth.userId;
  }

  if (!secret) {
    return Response.json({ error: 'SUPER_AGENT_HEARTBEAT_SECRET is not configured.' }, { status: 500 });
  }

  let targets: TriggerTarget[] = [];

  if (conversationId) {
    const [conversation] = await db
      .select({
        id: conversationsSchema.id,
        userId: conversationsSchema.userId,
      })
      .from(conversationsSchema)
      .where(
        authUserId
          ? and(eq(conversationsSchema.id, conversationId), eq(conversationsSchema.userId, authUserId))
          : eq(conversationsSchema.id, conversationId),
      )
      .limit(1);

    if (!conversation?.userId) {
      return Response.json({ error: 'Conversation not found or cannot run in background without an authenticated owner.' }, { status: 404 });
    }

    const [superAgent] = await db
      .select()
      .from(conversationSuperAgentsSchema)
      .where(eq(conversationSuperAgentsSchema.conversationId, conversationId))
      .limit(1);

    if (!superAgent || (!superAgent.enabled && !force)) {
      return Response.json({ error: 'Super agent is not enabled for this conversation.' }, { status: 400 });
    }

    targets = [{
      conversationId,
      userId: conversation.userId,
      model: superAgent.model,
      wakePrompt: superAgent.wakePrompt,
      heartbeatMinutes: superAgent.heartbeatMinutes,
    }];
  } else {
    if (!isInternalHeartbeatRequest) {
      return Response.json({ error: 'conversationId is required for manual wake-ups.' }, { status: 400 });
    }

    const dueAgents = await db
      .select({
        conversationId: conversationSuperAgentsSchema.conversationId,
        userId: conversationsSchema.userId,
        model: conversationSuperAgentsSchema.model,
        wakePrompt: conversationSuperAgentsSchema.wakePrompt,
        heartbeatMinutes: conversationSuperAgentsSchema.heartbeatMinutes,
      })
      .from(conversationSuperAgentsSchema)
      .innerJoin(conversationsSchema, eq(conversationSuperAgentsSchema.conversationId, conversationsSchema.id))
      .where(and(
        eq(conversationSuperAgentsSchema.enabled, true),
        lte(conversationSuperAgentsSchema.nextHeartbeatAt, new Date()),
      ))
      .orderBy(asc(conversationSuperAgentsSchema.nextHeartbeatAt))
      .limit(limit);

    targets = dueAgents
      .filter(agent => !!agent.userId)
      .map(agent => ({
        conversationId: agent.conversationId,
        userId: agent.userId!,
        model: agent.model,
        wakePrompt: agent.wakePrompt,
        heartbeatMinutes: agent.heartbeatMinutes,
      }));
  }

  const results = [];
  for (const target of targets) {
    results.push(await triggerConversationRun(req, target, secret));
  }

  return Response.json({ triggered: results.length, results });
}
