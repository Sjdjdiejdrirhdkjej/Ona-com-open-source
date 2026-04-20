import type { NextRequest } from 'next/server';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/libs/DB';
import { authFailureResponse, getRequestAuth, isAuthFailure, requireApiKeyScope } from '@/libs/ApiKeys';
import { DEFAULT_SUPER_AGENT_HEARTBEAT_MINUTES, DEFAULT_SUPER_AGENT_MODEL, DEFAULT_SUPER_AGENT_PROMPT, getNextHeartbeatAt } from '@/libs/SuperAgent';
import { conversationsSchema, conversationSuperAgentsSchema } from '@/models/Schema';

const superAgentSchema = z.object({
  enabled: z.boolean(),
  heartbeatMinutes: z.number().int().min(1).max(24 * 60),
  wakePrompt: z.string().trim().min(1).max(4000),
  model: z.enum(['ona-max', 'ona-hands-off']),
});

type SuperAgentRow = InferSelectModel<typeof conversationSuperAgentsSchema>;

function serializeSuperAgent(config?: SuperAgentRow) {
  if (!config) {
    return {
      enabled: false,
      heartbeatMinutes: DEFAULT_SUPER_AGENT_HEARTBEAT_MINUTES,
      wakePrompt: DEFAULT_SUPER_AGENT_PROMPT,
      model: DEFAULT_SUPER_AGENT_MODEL,
      nextHeartbeatAt: null,
      lastHeartbeatAt: null,
      lastRunStatus: 'idle',
    };
  }

  return {
    enabled: config.enabled,
    heartbeatMinutes: config.heartbeatMinutes,
    wakePrompt: config.wakePrompt,
    model: config.model,
    nextHeartbeatAt: config.nextHeartbeatAt?.toISOString() ?? null,
    lastHeartbeatAt: config.lastHeartbeatAt?.toISOString() ?? null,
    lastRunStatus: config.lastRunStatus,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getRequestAuth(req);
  if (isAuthFailure(auth)) return authFailureResponse(auth);
  if (!auth) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const { id } = await params;
  const [conversation] = await db
    .select({ id: conversationsSchema.id })
    .from(conversationsSchema)
    .where(and(eq(conversationsSchema.id, id), eq(conversationsSchema.userId, auth.userId)))
    .limit(1);

  if (!conversation) {
    return Response.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const [superAgent] = await db
    .select()
    .from(conversationSuperAgentsSchema)
    .where(eq(conversationSuperAgentsSchema.conversationId, id))
    .limit(1);

  return Response.json(serializeSuperAgent(superAgent));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getRequestAuth(req);
  if (isAuthFailure(auth)) return authFailureResponse(auth);
  if (!auth) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const scopeFailure = requireApiKeyScope(auth, 'task_running');
  if (scopeFailure) return authFailureResponse(scopeFailure);

  const { id } = await params;
  const [conversation] = await db
    .select({ id: conversationsSchema.id })
    .from(conversationsSchema)
    .where(and(eq(conversationsSchema.id, id), eq(conversationsSchema.userId, auth.userId)))
    .limit(1);

  if (!conversation) {
    return Response.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = superAgentSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map(issue => issue.message).join('; ') }, { status: 400 });
  }

  const now = new Date();
  const payload = parsed.data;

  await db
    .insert(conversationSuperAgentsSchema)
    .values({
      conversationId: id,
      enabled: payload.enabled,
      heartbeatMinutes: payload.heartbeatMinutes,
      wakePrompt: payload.wakePrompt,
      model: payload.model,
      nextHeartbeatAt: payload.enabled ? getNextHeartbeatAt(payload.heartbeatMinutes, now) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: conversationSuperAgentsSchema.conversationId,
      set: {
        enabled: payload.enabled,
        heartbeatMinutes: payload.heartbeatMinutes,
        wakePrompt: payload.wakePrompt,
        model: payload.model,
        nextHeartbeatAt: payload.enabled ? getNextHeartbeatAt(payload.heartbeatMinutes, now) : null,
        updatedAt: now,
      },
    });

  const [superAgent] = await db
    .select()
    .from(conversationSuperAgentsSchema)
    .where(eq(conversationSuperAgentsSchema.conversationId, id))
    .limit(1);

  return Response.json(serializeSuperAgent(superAgent));
}
