import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/libs/DB';
import { codebaseMemorySchema } from '@/models/Schema';
import pino from 'pino';

const logger = pino({ name: 'Memory' });

const EXTRACTION_MODEL =
  process.env.FLEET_MODEL ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct';

const MAX_MEMORY_ITEMS = 50;
const MAX_INPUT_CHARS = 12000;

export type MemoryItem = {
  key: string;
  content: string;
  category: 'tool' | 'convention' | 'pattern' | 'preference' | 'mistake';
};

type RawMessage = {
  role: string;
  content: unknown;
  tool_calls?: unknown;
};

const VALID_CATEGORIES = new Set(['tool', 'convention', 'pattern', 'preference', 'mistake']);

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extractor for an AI software engineering agent.

Analyse the following task conversation and extract factual, reusable learnings about the user's codebase, toolchain, and workflow preferences.

Extract ONLY things that apply broadly to future tasks — not task-specific outcomes:
GOOD examples:
- "Uses pnpm workspaces, not npm" (tool)
- "Tests run with Vitest; command is 'pnpm test'" (tool)
- "Next.js 15 App Router — no pages/ directory" (convention)
- "Branches named feat/<slug> or fix/<slug>" (preference)
- "Drizzle ORM for DB; migrations live in migrations/" (convention)
- "GitHub Actions CI runs on push to main and on PRs" (pattern)
- "DB schema uses async getDb() — never the synchronous db export" (mistake)
BAD examples (skip these):
- "Fixed bug in UserAuth.tsx line 42" (task-specific)
- "User asked to add dark mode" (task-specific)
- "Created file X" (task-specific)

Return a JSON array of memory items. Each item must have:
- key: short unique snake_case identifier (e.g. "package_manager", "test_runner", "branch_naming")
- content: concise factual statement, 1–2 sentences max
- category: one of "tool" | "convention" | "pattern" | "preference" | "mistake"

Return ONLY the raw JSON array. No markdown fences, no explanation text. If nothing useful found, return [].`;

function buildConversationExcerpt(messages: RawMessage[]): string {
  const parts: string[] = [];
  let chars = 0;

  for (const msg of messages) {
    if (chars >= MAX_INPUT_CHARS) break;
    if (msg.role === 'system') continue;

    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = (msg.content as Array<{ type?: string; text?: string }>)
        .filter(p => p.type === 'text')
        .map(p => p.text ?? '')
        .join(' ');
    }

    const limit = msg.role === 'tool' ? 400 : 1200;
    text = text.slice(0, limit).trim();
    if (!text) continue;

    parts.push(`[${msg.role}]: ${text}`);
    chars += text.length;
  }

  return parts.join('\n\n');
}

export async function extractAndStoreMemory(
  userId: string,
  taskSummary: string,
  messages: RawMessage[],
  conversationId?: string | null,
): Promise<void> {
  try {
    const apiKey = process.env.FIREWORKS_API_KEY;
    if (!apiKey) return;

    const excerpt = buildConversationExcerpt(messages);
    if (!excerpt) return;

    const userContent = `Task summary: ${taskSummary.slice(0, 500)}\n\nConversation excerpt:\n${excerpt}`;

    const resp = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
        temperature: 0.1,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'Memory: extraction API call failed');
      return;
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw || raw === '[]') return;

    let items: MemoryItem[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        items = parsed.filter((item: unknown) => {
          const i = item as Record<string, unknown>;
          return (
            typeof i.key === 'string' &&
            i.key.length > 0 &&
            typeof i.content === 'string' &&
            i.content.length > 0 &&
            typeof i.category === 'string'
          );
        });
      }
    } catch {
      logger.warn({ raw: raw.slice(0, 200) }, 'Memory: failed to parse extraction response');
      return;
    }

    if (items.length === 0) return;

    const db = await getDb();

    for (const item of items.slice(0, 20)) {
      const key = item.key.slice(0, 100).toLowerCase().replace(/\s+/g, '_');
      const content = item.content.slice(0, 500);
      const category = VALID_CATEGORIES.has(item.category) ? item.category : 'pattern';

      await db
        .insert(codebaseMemorySchema)
        .values({
          userId,
          key,
          content,
          category,
          confidence: 1,
          sourceConversationId: conversationId ?? null,
        })
        .onConflictDoUpdate({
          target: [codebaseMemorySchema.userId, codebaseMemorySchema.key],
          set: {
            content,
            category,
            confidence: sql`${codebaseMemorySchema.confidence} + 1`,
            updatedAt: new Date(),
            sourceConversationId: conversationId ?? null,
          },
        });
    }

    logger.info({ userId, count: items.length }, 'Memory: stored learnings');
  } catch (err) {
    logger.warn({ err, userId }, 'Memory: extractAndStoreMemory failed silently');
  }
}

export async function getUserMemory(userId: string): Promise<string> {
  try {
    const db = await getDb();
    const items = await db
      .select()
      .from(codebaseMemorySchema)
      .where(eq(codebaseMemorySchema.userId, userId))
      .orderBy(codebaseMemorySchema.confidence)
      .limit(MAX_MEMORY_ITEMS);

    if (items.length === 0) return '';

    const byCategory: Record<string, typeof items> = {};
    for (const item of items) {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category]!.push(item);
    }

    const LABELS: Record<string, string> = {
      tool: 'Tools & Build System',
      convention: 'Code Conventions',
      pattern: 'Patterns',
      preference: 'User Preferences',
      mistake: 'Common Mistakes (avoid these)',
    };

    const lines: string[] = ['## Codebase memory — facts learned from previous sessions\n'];
    for (const [cat, catItems] of Object.entries(byCategory)) {
      lines.push(`### ${LABELS[cat] ?? cat}`);
      for (const item of catItems) {
        const confidence = item.confidence > 1 ? ` (confirmed ${item.confidence}×)` : '';
        lines.push(`- **${item.key}**: ${item.content}${confidence}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    logger.warn({ err, userId }, 'Memory: getUserMemory failed silently');
    return '';
  }
}
