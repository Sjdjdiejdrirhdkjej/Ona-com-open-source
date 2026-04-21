const FIREWORKS_API_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';
const OVERSEER_MODEL = process.env.FIREWORKS_OVERSEER_MODEL ?? 'accounts/fireworks/models/glm-5p1';
const OVERSEER_MAX_ITERATIONS = 8;

const OVERSEER_SYSTEM_PROMPT = `You are OVERSEER, a strict plan-quality reviewer.

Your only job is to deeply review a proposed plan and return exactly one verdict prefix:
- BAD + [REASONING]
- OK + [REASONING]
- GOOD + [REASONING]

Guidance:
- Use BAD when the plan is missing critical scope, risks, validation, dependencies, or sequencing.
- Use OK when the plan is viable and safe enough to execute, even if not perfect.
- Use GOOD when the plan is strong, thorough, and low-risk.
- OK is sufficient for approval; GOOD is encouraged when realistically achievable.
- Keep reasoning concrete and actionable.
- Available tools are LIMITED to: glob and read_file.
- Do not invent tools; do not claim to inspect files you did not read.
- Do not output anything before the verdict prefix.`;

type OverseerToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OverseerMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: OverseerToolCall[];
};

type FireworksNonStreamResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

const OVERSEER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'List files in the workspace that match a glob pattern.',
      parameters: {
        type: 'object',
        required: ['pattern'],
        properties: {
          pattern: { type: 'string', description: 'Glob pattern like "src/**/*.ts".' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace.',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: 'Relative path from workspace root.' },
        },
        additionalProperties: false,
      },
      additionalProperties: false,
    },
  },
] as const;

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

async function collectFiles(root: string, relativeDir = ''): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const { join, posix } = await import('node:path');
  const fullDir = join(root, relativeDir);
  const entries = await readdir(fullDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next') continue;
      files.push(...await collectFiles(root, relPath));
    } else if (entry.isFile()) {
      files.push(posix.normalize(relPath));
    }
  }
  return files;
}

async function runInternalTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const root = process.cwd();
  if (name === 'glob') {
    const pattern = typeof args.pattern === 'string' ? args.pattern : '';
    if (!pattern) throw new Error('pattern is required');
    const regex = globToRegExp(pattern);
    const allFiles = await collectFiles(root);
    return { pattern, matches: allFiles.filter(file => regex.test(file)).slice(0, 500) };
  }
  if (name === 'read_file') {
    const relPath = typeof args.path === 'string' ? args.path : '';
    if (!relPath) throw new Error('path is required');
    if (relPath.includes('..')) throw new Error('path traversal is not allowed');
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const fullPath = path.join(root, relPath);
    const content = await readFile(fullPath, 'utf8');
    return { path: relPath, content: content.slice(0, 40000) };
  }
  throw new Error(`Unknown Overseer tool: ${name}`);
}

async function overseerCall(messages: OverseerMessage[]): Promise<{ content: string; toolCalls: OverseerToolCall[] }> {
  if (!process.env.FIREWORKS_API_KEY) {
    throw new Error('FIREWORKS_API_KEY is not configured.');
  }

  const res = await fetch(FIREWORKS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`,
    },
    body: JSON.stringify({
      model: OVERSEER_MODEL,
      messages,
      tools: OVERSEER_TOOLS,
      tool_choice: 'auto',
      max_tokens: 4096,
      temperature: 0.1,
      reasoning_effort: 'high',
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Overseer AI error (${res.status}): ${text}`);
  }

  const json = await res.json() as FireworksNonStreamResponse;
  if (json.error?.message) throw new Error(`Overseer AI error: ${json.error.message}`);
  const msg = json.choices?.[0]?.message;
  const toolCalls: OverseerToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
    id: tc.id ?? crypto.randomUUID(),
    type: 'function',
    function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
  }));
  return { content: msg?.content?.trim() ?? '', toolCalls };
}

function normalizeVerdict(result: string): string {
  const trimmed = result.trim();
  if (/^BAD\s*\+/i.test(trimmed)) return trimmed;
  if (/^OK\s*\+/i.test(trimmed)) return trimmed;
  if (/^GOOD\s*\+/i.test(trimmed)) return trimmed;
  return `BAD + Invalid Overseer format. Expected "BAD +", "OK +", or "GOOD +". Raw output: ${trimmed || '(empty)'}`;
}

export async function runOverseerSubagent(plan: string): Promise<string> {
  const messages: OverseerMessage[] = [
    { role: 'system', content: OVERSEER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Review this proposed plan deeply and return one verdict with reasoning.\n\n${plan}`,
    },
  ];

  for (let i = 0; i < OVERSEER_MAX_ITERATIONS; i++) {
    const { content, toolCalls } = await overseerCall(messages);
    if (!toolCalls.length) {
      return normalizeVerdict(content);
    }

    messages.push({ role: 'assistant', content, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      const args = parseArgs(tc.function.arguments);
      let result: unknown;
      try {
        result = await runInternalTool(tc.function.name, args);
      } catch (error) {
        result = { error: (error as Error).message };
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return 'BAD + Overseer reached iteration limit before producing a verdict.';
}

export const callOverseerToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'call_overseer',
    description:
      'Ask the Overseer subagent to deeply review a proposed plan and return exactly one verdict: BAD + [REASONING], OK + [REASONING], or GOOD + [REASONING]. OK is sufficient to proceed; GOOD is encouraged.',
    parameters: {
      type: 'object',
      required: ['plan'],
      properties: {
        plan: {
          type: 'string',
          description: 'The full proposed plan text to be reviewed by Overseer.',
        },
      },
      additionalProperties: false,
    },
  },
};

export function isCallOverseerTool(name: string): boolean {
  return name === 'call_overseer';
}
