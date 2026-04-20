/**
 * Editor subagent — invoked exclusively by the main ONA but OPEN SOURCE AI via `call_editor`.
 *
 * Architecture:
 *   Main AI ──call_editor──▶ runEditorSubagent()
 *                               └── own Fireworks call
 *                               └── own agentic loop (up to 15 rounds)
 *                               └── restricted toolset (3 tools: read_file, write_file, edit_file)
 *                               └── operates on the local project filesystem
 *                               └── returns report + touchedFiles ──▶ Main AI
 *
 * The 3 internal tools are NEVER exposed to the main AI directly.
 * The main AI delegates ALL local file changes to this subagent — it never writes files itself.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { createFileDiff } from './FileDiff';
import type { TouchedFileDiff } from './FileDiff';

const FIREWORKS_API_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';
const EDITOR_MODEL = process.env.FIREWORKS_EDITOR_MODEL ?? 'accounts/fireworks/models/glm-5p1';
const EDITOR_MAX_ITERATIONS = 15;

const PROJECT_ROOT = process.cwd();

function safePath(filePath: string): string {
  const resolved = resolve(PROJECT_ROOT, filePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Access denied: "${filePath}" is outside the project root.`);
  }
  return resolved;
}

const EDITOR_SYSTEM_PROMPT = `You are **THE EDITOR**, a specialist file-editing subagent inside the ONA but OPEN SOURCE engineering system.

Your sole job: apply precise, correct file changes to the local project filesystem using the three tools available to you.

---

## TOOLS

- **read_file(path)** — Read any file in the project. Always read a file before editing it.
- **write_file(path, content)** — Write the complete content of a file. Use for new files or when a full rewrite is needed.
- **edit_file(path, old_string, new_string)** — Replace the first exact occurrence of \`old_string\` with \`new_string\` in an existing file. Preferred over write_file for targeted changes.

---

## STRICT RULES

### 1. Always read before editing
Call \`read_file\` on every file before calling \`edit_file\` or \`write_file\`. Never assume the file content — verify it first.

### 2. Prefer edit_file over write_file
Use \`edit_file\` for targeted changes. Only use \`write_file\` when creating a new file or when the instructions clearly require a full rewrite.

### 3. Use enough context in old_string for uniqueness
When calling \`edit_file\`, include 4–8 surrounding lines in \`old_string\` to ensure the match is unique. A short or ambiguous \`old_string\` will be rejected.

### 4. Never fabricate file content
Only write what you have seen in a \`read_file\` result. Do not invent file paths, imports, function signatures, or content that you have not confirmed exists.

### 5. Apply all requested changes
Work through every file mentioned in the instructions. Do not skip changes or leave todos incomplete.

### 6. Handle errors gracefully
If \`edit_file\` fails because \`old_string\` is not found, re-read the file and try again with the correct string. Never give up on a change without trying at least twice.

---

## WORKFLOW

1. **Read all relevant files in parallel** (fire multiple \`read_file\` calls at once).
2. **Apply changes** using \`edit_file\` (targeted) or \`write_file\` (full rewrite / new file).
3. **Verify** by reading back each edited file to confirm the change landed correctly.
4. **Return a structured report** of everything that was changed.

---

## OUTPUT FORMAT

Return a Markdown report:

- **Summary**: What was accomplished (2–4 sentences).
- **Changes made**: File-by-file list — path, what changed, and why.
- **Verification**: Confirmation that each edit was read back and looks correct.
- **Issues**: Any changes that could not be applied, and why.`;

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const INTERNAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the complete content of a file from the local project filesystem. ' +
        'Always call this before editing a file to see its current content. ' +
        'Returns the file content as a string. Throws if the file does not exist.',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root (e.g. "src/components/Header.tsx").',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Write the complete content of a file to the local project filesystem. ' +
        'Creates the file (and any missing parent directories) if it does not exist. ' +
        'Overwrites the file if it already exists. ' +
        'Use this for new files or when a full rewrite is required. ' +
        'For targeted changes to existing files, prefer edit_file instead.',
      parameters: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root (e.g. "src/libs/NewUtil.ts").',
          },
          content: {
            type: 'string',
            description: 'The complete file content to write.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Make a targeted edit to an existing file by replacing the first exact occurrence of old_string with new_string. ' +
        'Always call read_file first to get the current content. ' +
        'Include 4–8 surrounding lines in old_string to ensure the match is unique. ' +
        'The match is exact — whitespace, indentation, and newlines must match precisely. ' +
        'Returns an error if old_string is not found or matches more than once.',
      parameters: {
        type: 'object',
        required: ['path', 'old_string', 'new_string'],
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root.',
          },
          old_string: {
            type: 'string',
            description: 'The exact text to find in the file, including surrounding context for uniqueness.',
          },
          new_string: {
            type: 'string',
            description: 'The text to replace old_string with.',
          },
        },
        additionalProperties: false,
      },
    },
  },
];

type EditorToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type EditorMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: EditorToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type FireworksNonStreamResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

async function editorCall(messages: EditorMessage[]): Promise<{ content: string; toolCalls: EditorToolCall[] }> {
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
      model: EDITOR_MODEL,
      messages,
      tools: INTERNAL_TOOLS,
      tool_choice: 'auto',
      max_tokens: 32768,
      temperature: 0.0,
      reasoning_effort: 'high',
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Editor AI error (${res.status}): ${text}`);
  }

  const json = await res.json() as FireworksNonStreamResponse;
  if (json.error?.message) throw new Error(`Editor AI error: ${json.error.message}`);

  const msg = json.choices?.[0]?.message;
  const rawContent = msg?.content ?? '';
  const reasoningContent = msg?.reasoning_content ?? '';
  const content = reasoningContent
    ? `<think>${reasoningContent}</think>${rawContent}`
    : rawContent;

  const toolCalls: EditorToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
    id: tc.id ?? crypto.randomUUID(),
    type: 'function',
    function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
  }));

  return { content, toolCalls };
}

function parseArgs(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') as Record<string, unknown>; } catch { return {}; }
}

function internalStepLabel(name: string, args: Record<string, unknown>): string {
  const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '');
  const trim = (v: string, max = 55) => (v.length > max ? `${v.slice(0, max)}…` : v);

  switch (name) {
    case 'read_file':
      return `Reading ${trim(s('path'))}`;
    case 'write_file':
      return `Writing ${trim(s('path'))}`;
    case 'edit_file':
      return `Editing ${trim(s('path'))}`;
    default:
      return name;
  }
}

function runInternalTool(name: string, args: Record<string, unknown>, touchedFiles: TouchedFileDiff[]): unknown {
  const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '');

  if (name === 'read_file') {
    const filePath = s('path');
    if (!filePath) throw new Error('path is required');
    const abs = safePath(filePath);
    if (!existsSync(abs)) throw new Error(`File not found: ${filePath}`);
    const content = readFileSync(abs, 'utf-8');
    return {
      path: filePath,
      char_count: content.length,
      line_count: content.split('\n').length,
      content,
    };
  }

  if (name === 'write_file') {
    const filePath = s('path');
    const content = s('content');
    if (!filePath) throw new Error('path is required');
    const abs = safePath(filePath);
    const before = existsSync(abs) ? readFileSync(abs, 'utf-8') : null;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
    const diff = createFileDiff(filePath, before, content);
    touchedFiles.push(diff);
    return {
      ok: true,
      path: filePath,
      status: before === null ? 'created' : 'modified',
      char_count: content.length,
    };
  }

  if (name === 'edit_file') {
    const filePath = s('path');
    const oldString = s('old_string');
    const newString = s('new_string');
    if (!filePath) throw new Error('path is required');
    if (!oldString) throw new Error('old_string is required');
    const abs = safePath(filePath);
    if (!existsSync(abs)) throw new Error(`File not found: ${filePath}`);
    const before = readFileSync(abs, 'utf-8');
    const occurrences = before.split(oldString).length - 1;
    if (occurrences === 0) {
      throw new Error(
        `old_string not found in ${filePath}. ` +
        `Make sure the text exactly matches the file content (including whitespace and indentation). ` +
        `Call read_file again to verify the current content.`,
      );
    }
    if (occurrences > 1) {
      throw new Error(
        `old_string matches ${occurrences} locations in ${filePath}. ` +
        `Add more surrounding context to old_string to make it uniquely match one location.`,
      );
    }
    const after = before.replace(oldString, newString);
    writeFileSync(abs, after, 'utf-8');
    const diff = createFileDiff(filePath, before, after);
    touchedFiles.push(diff);
    return { ok: true, path: filePath, status: 'modified' };
  }

  throw new Error(`Unknown editor internal tool: ${name}`);
}

export type EditorStepCallback = (
  event: 'start' | 'complete',
  stepLabel: string,
  error?: boolean,
) => void;

export type EditorResult = {
  report: string;
  touchedFiles: TouchedFileDiff[];
};

export async function runEditorSubagent(
  instructions: string,
  files: string[],
  onStep?: EditorStepCallback,
): Promise<EditorResult> {
  const touchedFiles: TouchedFileDiff[] = [];
  const filesContext = files.length > 0
    ? `\n\nFiles to work with:\n${files.map(f => `- ${f}`).join('\n')}`
    : '';

  const messages: EditorMessage[] = [
    { role: 'system', content: EDITOR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Main AI instructions:\n\n${instructions}${filesContext}\n\nApply all changes, then return a structured report of what was done.`,
    },
  ];

  for (let iteration = 0; iteration < EDITOR_MAX_ITERATIONS; iteration++) {
    let response: { content: string; toolCalls: EditorToolCall[] };
    try {
      response = await editorCall(messages);
    } catch (error) {
      throw new Error(`Editor subagent call failed: ${(error as Error).message}`);
    }

    const { content, toolCalls } = response;

    if (!toolCalls.length) {
      return {
        report: content || 'The Editor completed all changes but produced no written report.',
        touchedFiles,
      };
    }

    messages.push({ role: 'assistant', content, tool_calls: toolCalls });

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgs = parseArgs(toolCall.function.arguments);
      const stepLabel = internalStepLabel(toolName, toolArgs);

      onStep?.('start', stepLabel);
      try {
        const result = runInternalTool(toolName, toolArgs, touchedFiles);
        onStep?.('complete', stepLabel);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result).slice(0, 24000),
        });
      } catch (error) {
        onStep?.('complete', stepLabel, true);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: (error as Error).message }),
        });
      }
    }
  }

  return {
    report: 'Editor reached the maximum iteration limit. The changes applied so far are recorded in touchedFiles.',
    touchedFiles,
  };
}

export const callEditorToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'call_editor',
    description:
      'Delegate ALL local file read/write/edit operations to the Editor subagent. ' +
      'The Editor is the ONLY subagent that can read and modify files on the local project filesystem. ' +
      'Provide clear instructions describing what changes to make and list every file that needs to be read or modified. ' +
      'The Editor will read each file, apply precise targeted edits, verify the results, and return a detailed report with a diff of every change. ' +
      'Use this tool for ANY task that involves creating, reading, or modifying local project files — never write file content directly in your response.',
    parameters: {
      type: 'object',
      required: ['instructions', 'files'],
      properties: {
        instructions: {
          type: 'string',
          description:
            'Clear, complete description of all the changes the Editor should make. ' +
            'Include what to change, where, and why. Be specific about exact strings, values, or patterns to update.',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Relative paths (from the project root) of all files the Editor should read or modify. ' +
            'Include every file that needs to be touched, even files that are only read for context.',
        },
      },
      additionalProperties: false,
    },
  },
};

export function isCallEditorTool(name: string): boolean {
  return name === 'call_editor';
}
