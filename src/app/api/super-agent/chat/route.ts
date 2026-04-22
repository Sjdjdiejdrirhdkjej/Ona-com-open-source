import type { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { authFailureResponse, getRequestAuth, isAuthFailure, requireApiKeyScope } from '@/libs/ApiKeys';
import { runOpencode } from '@/libs/OpencodeAgent';
import { conversationsSchema, messagesSchema } from '@/models/Schema';

export const runtime = 'nodejs';

const requestSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1),
  assistantMessageId: z.string().min(1).optional(),
});

function sseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 });
  }

  const secret = process.env.SUPER_AGENT_HEARTBEAT_SECRET;
  const isInternal = Boolean(secret && req.headers.get('x-ona-heartbeat-secret') === secret);

  let userId: string | null = null;
  if (!isInternal) {
    const auth = await getRequestAuth(req);
    if (isAuthFailure(auth)) return authFailureResponse(auth);
    if (!auth) return Response.json({ error: 'Authentication required.' }, { status: 401 });
    const scopeFailure = requireApiKeyScope(auth, 'task_running');
    if (scopeFailure) return authFailureResponse(scopeFailure);
    userId = auth.userId;
  }

  const { conversationId, message, assistantMessageId } = parsed.data;

  const [conversation] = await db
    .select({ id: conversationsSchema.id, userId: conversationsSchema.userId })
    .from(conversationsSchema)
    .where(
      userId
        ? and(eq(conversationsSchema.id, conversationId), eq(conversationsSchema.userId, userId))
        : eq(conversationsSchema.id, conversationId),
    )
    .limit(1);

  if (!conversation) {
    return Response.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const finalAssistantId = assistantMessageId ?? crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let assistantText = '';
      let errored = false;

      controller.enqueue(enc.encode(sseEvent({ type: 'assistant_msg_id', messageId: finalAssistantId })));

      try {
        for await (const event of runOpencode({ conversationId, message })) {
          if (event.type === 'session') {
            controller.enqueue(enc.encode(sseEvent({ type: 'session', sessionID: event.sessionID })));
          } else if (event.type === 'text') {
            assistantText += event.text;
            controller.enqueue(enc.encode(sseEvent({ delta: event.text })));
          } else if (event.type === 'tool_start') {
            controller.enqueue(enc.encode(sseEvent({ type: 'tool_start', tool: event.tool })));
          } else if (event.type === 'tool_finish') {
            controller.enqueue(enc.encode(sseEvent({ type: 'tool_finish', tool: event.tool })));
          } else if (event.type === 'error') {
            errored = true;
            controller.enqueue(enc.encode(sseEvent({ type: 'error', message: event.message })));
          }
        }

        if (assistantText.trim().length > 0) {
          try {
            await db.insert(messagesSchema).values({
              id: finalAssistantId,
              conversationId,
              role: 'assistant',
              content: assistantText,
            });
            await db
              .update(conversationsSchema)
              .set({ updatedAt: new Date() })
              .where(eq(conversationsSchema.id, conversationId));
          } catch (err) {
            logger.error('Failed to persist assistant message', err);
          }
        }

        controller.enqueue(enc.encode(sseEvent({ type: 'done', error: errored })));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(enc.encode(sseEvent({ type: 'error', message: (err as Error).message })));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
