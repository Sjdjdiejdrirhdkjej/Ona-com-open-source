import type { NextRequest } from 'next/server';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getUser } from '@/libs/auth';
import { agentJobsSchema, conversationsSchema, messagesSchema } from '@/models/Schema';

export async function GET(req: NextRequest) {
  const user = await getUser();
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (user) {
    // If the request also carries a sessionId, silently migrate any unclaimed
    // conversations from that session to this user so they aren't lost.
    if (sessionId) {
      await db
        .update(conversationsSchema)
        .set({ userId: user.id })
        .where(and(eq(conversationsSchema.sessionId, sessionId), isNull(conversationsSchema.userId)));
    }

    const conversations = await db
      .select()
      .from(conversationsSchema)
      .where(eq(conversationsSchema.userId, user.id))
      .orderBy(desc(conversationsSchema.updatedAt));

    return Response.json(await hydrateConversations(conversations));
  }

  // Unauthenticated fallback: scope by sessionId
  const whereClause = sessionId
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

      const activeJob = runningJobs[0] ?? null;

      return {
        ...conv,
        activeJobId: activeJob?.id ?? null,
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
  const user = await getUser();
  const { id, title, sessionId } = await req.json() as { id: string; title: string; sessionId?: string };

  const [conv] = await db
    .insert(conversationsSchema)
    .values({
      id,
      title,
      sessionId: sessionId ?? null,
      userId: user?.id ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return Response.json(conv ?? { id, title }, { status: conv ? 201 : 200 });
}
