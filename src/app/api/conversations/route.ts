import type { NextRequest } from 'next/server';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { authFailureResponse, getRequestAuth, isAuthFailure, requireApiKeyScope } from '@/libs/ApiKeys';
import { agentJobsSchema, conversationsSchema, conversationSuperAgentsSchema, messagesSchema } from '@/models/Schema';
import { DEFAULT_SUPER_AGENT_HEARTBEAT_MINUTES, DEFAULT_SUPER_AGENT_MODEL, DEFAULT_SUPER_AGENT_PROMPT } from '@/libs/SuperAgent';

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (isAuthFailure(auth)) {
    return authFailureResponse(auth);
  }

  const sessionId = req.nextUrl.searchParams.get('sessionId');

  const whereClause = auth
    ? eq(conversationsSchema.userId, auth.userId)
    : sessionId
    ? eq(conversationsSchema.sessionId, sessionId)
    : or(isNull(conversationsSchema.sessionId), eq(conversationsSchema.sessionId, ''));

  const conversations = await db
    .select()
    .from(conversationsSchema)
    .where(whereClause)
    .orderBy(desc(conversationsSchema.updatedAt));

  return Response.json(await hydrateConversations(conversations));
}

async function hydrateConversations(conversations: (typeof conversationsSchema.$inferSelect)[]) {
  return Promise.all(
    conversations.map(async (conv) => {
      const messages = await db
        .select()
        .from(messagesSchema)
        .where(eq(messagesSchema.conversationId, conv.id))
        .orderBy(messagesSchema.createdAt);

      const runningJobs = await db
        .select()
        .from(agentJobsSchema)
        .where(and(eq(agentJobsSchema.conversationId, conv.id), eq(agentJobsSchema.status, 'running')));

      const [superAgent] = await db
        .select()
        .from(conversationSuperAgentsSchema)
        .where(eq(conversationSuperAgentsSchema.conversationId, conv.id))
        .limit(1);

      const activeJob = runningJobs[0] ?? null;

      return {
        ...conv,
        activeJobId: activeJob?.id ?? null,
        superAgent: superAgent
          ? {
              enabled: superAgent.enabled,
              heartbeatMinutes: superAgent.heartbeatMinutes,
              wakePrompt: superAgent.wakePrompt,
              model: superAgent.model,
              nextHeartbeatAt: superAgent.nextHeartbeatAt?.toISOString() ?? null,
              lastHeartbeatAt: superAgent.lastHeartbeatAt?.toISOString() ?? null,
              lastRunStatus: superAgent.lastRunStatus,
            }
          : {
              enabled: false,
              heartbeatMinutes: DEFAULT_SUPER_AGENT_HEARTBEAT_MINUTES,
              wakePrompt: DEFAULT_SUPER_AGENT_PROMPT,
              model: DEFAULT_SUPER_AGENT_MODEL,
              nextHeartbeatAt: null,
              lastHeartbeatAt: null,
              lastRunStatus: 'idle',
            },
        messages: messages.map(m => ({
          ...m,
          content: (() => {
            try {
              return JSON.parse(m.content);
            } catch {
              return m.content;
            }
          })(),
        })),
      };
    }),
  );
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (isAuthFailure(auth)) {
    return authFailureResponse(auth);
  }
  const scopeFailure = requireApiKeyScope(auth, 'task_running');
  if (scopeFailure) {
    return authFailureResponse(scopeFailure);
  }

  const { id, title, sessionId } = await req.json() as { id: string; title: string; sessionId?: string };

  const [conv] = await db
    .insert(conversationsSchema)
    .values({
      id,
      title,
      sessionId: sessionId ?? null,
      userId: auth?.userId ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return Response.json(conv ?? { id, title }, { status: conv ? 201 : 200 });
}
