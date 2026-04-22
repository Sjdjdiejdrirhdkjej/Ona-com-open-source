import { spawn } from 'node:child_process';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { conversationsSchema } from '@/models/Schema';

const OPENCODE_BIN = path.resolve(process.cwd(), 'node_modules/.bin/opencode');

export type OpencodeEvent =
  | { type: 'session'; sessionID: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start'; tool: string }
  | { type: 'tool_finish'; tool: string }
  | { type: 'step_finish' }
  | { type: 'error'; message: string }
  | { type: 'done' };

type RawEvent = {
  type?: string;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    tool?: string;
    name?: string;
  };
  message?: string;
  error?: { message?: string };
};

/**
 * Run opencode for a single message in a conversation. Yields a stream of
 * structured events. The opencode session ID for the conversation is loaded
 * from / persisted to the `conversations.opencode_session_id` column.
 *
 * This is the foundational skeleton of the super agent — every wake-up
 * (manual chat or scheduled heartbeat) routes through this function.
 */
export async function* runOpencode(opts: {
  conversationId: string;
  message: string;
}): AsyncGenerator<OpencodeEvent, void, void> {
  const { conversationId, message } = opts;

  const [conversation] = await db
    .select({ opencodeSessionId: conversationsSchema.opencodeSessionId })
    .from(conversationsSchema)
    .where(eq(conversationsSchema.id, conversationId))
    .limit(1);

  const existingSessionId = conversation?.opencodeSessionId ?? null;

  const args = [
    'run',
    message,
    '--format', 'json',
    '--dangerously-skip-permissions',
  ];
  if (existingSessionId) {
    args.push('--session', existingSessionId);
  }

  const child = spawn(OPENCODE_BIN, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrBuffer = '';
  child.stderr.on('data', chunk => {
    stderrBuffer += chunk.toString();
  });

  let capturedSessionId: string | null = existingSessionId;
  let buffer = '';
  let finished = false;

  const queue: OpencodeEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let rejectNext: ((err: Error) => void) | null = null;

  function push(ev: OpencodeEvent) {
    queue.push(ev);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      rejectNext = null;
      r();
    }
  }

  function handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let raw: RawEvent;
    try {
      raw = JSON.parse(trimmed) as RawEvent;
    } catch {
      return;
    }

    if (raw.sessionID && raw.sessionID !== capturedSessionId) {
      capturedSessionId = raw.sessionID;
      push({ type: 'session', sessionID: raw.sessionID });
    }

    if (raw.type === 'text' && raw.part?.type === 'text' && typeof raw.part.text === 'string') {
      push({ type: 'text', text: raw.part.text });
      return;
    }

    if (raw.type === 'tool_start' || raw.part?.type === 'tool-invocation') {
      const tool = raw.part?.tool ?? raw.part?.name ?? 'tool';
      push({ type: 'tool_start', tool });
      return;
    }

    if (raw.type === 'tool_finish' || raw.part?.type === 'tool-result') {
      const tool = raw.part?.tool ?? raw.part?.name ?? 'tool';
      push({ type: 'tool_finish', tool });
      return;
    }

    if (raw.type === 'step_finish') {
      push({ type: 'step_finish' });
      return;
    }

    if (raw.type === 'error' || raw.error?.message) {
      push({ type: 'error', message: raw.error?.message ?? raw.message ?? 'Unknown opencode error' });
    }
  }

  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  });

  child.on('error', err => {
    if (rejectNext) {
      const r = rejectNext;
      resolveNext = null;
      rejectNext = null;
      r(err);
    } else {
      push({ type: 'error', message: err.message });
      finished = true;
    }
  });

  child.on('close', code => {
    if (buffer) {
      handleLine(buffer);
      buffer = '';
    }
    if (code !== 0 && code !== null) {
      const tail = stderrBuffer.split('\n').slice(-5).join('\n').trim();
      push({ type: 'error', message: `opencode exited with code ${code}${tail ? `: ${tail}` : ''}` });
    }
    push({ type: 'done' });
    finished = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      rejectNext = null;
      r();
    }
  });

  try {
    while (true) {
      if (queue.length > 0) {
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === 'done') break;
        continue;
      }
      if (finished) break;
      await new Promise<void>((resolve, reject) => {
        resolveNext = resolve;
        rejectNext = reject;
      });
    }
  } finally {
    if (!child.killed && child.exitCode === null) {
      try { child.kill('SIGTERM'); } catch {}
    }
    if (capturedSessionId && capturedSessionId !== existingSessionId) {
      try {
        await db
          .update(conversationsSchema)
          .set({ opencodeSessionId: capturedSessionId, updatedAt: new Date() })
          .where(eq(conversationsSchema.id, conversationId));
      } catch (err) {
        logger.error('Failed to persist opencode session id', err);
      }
    }
  }
}
