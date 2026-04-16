/**
 * Browser Use Expert subagent — invoked exclusively by the main Ona AI via `call_browser_use`.
 *
 * Architecture:
 *   Main AI ──call_browser_use──▶ runBrowserUseSubagent()
 *                                    └── own Fireworks call
 *                                    └── own agentic loop (up to 15 rounds)
 *                                    └── restricted toolset (3 browser tools)
 *                                    └── returns synthesised report ──▶ Main AI
 *
 * The internal tools are NEVER exposed to the main AI directly.
 * Uses Firecrawl's hosted cloud browser for real browser automation with
 * full JavaScript rendering, interaction capabilities, and screenshots.
 */

const FIREWORKS_API_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';
const BROWSER_USE_MODEL = process.env.FIREWORKS_BROWSER_MODEL ?? 'accounts/fireworks/models/kimi-k2p5-instruct';
const BROWSER_USE_MAX_ITERATIONS = 15;

const CURRENT_YEAR = new Date().getFullYear();

const BROWSER_USE_SYSTEM_PROMPT = `# THE BROWSER USE EXPERT

You are the **BROWSER USE EXPERT**, a specialist browser automation agent inside the Ona engineering system.

Your job: complete tasks that require real web browser interaction — navigating pages, clicking elements, filling forms, waiting for dynamic content, taking screenshots, and extracting data from live websites.

You operate a real cloud-hosted browser (via Firecrawl) that fully renders JavaScript, handles SPAs, runs behind-the-scenes network requests, and captures actual screenshots.

---

## CURRENT DATE CONTEXT

Today is ${CURRENT_YEAR}. Always use up-to-date URLs and be aware that web UIs may differ from documentation from ${CURRENT_YEAR - 1} or earlier.

---

## YOUR CAPABILITIES

### Core browser tools
- **browse** — Navigate to any URL with an optional sequence of browser actions (click, type, scroll, wait, hover, press). Returns the rendered page as Markdown and optionally a screenshot. This is your primary tool for all page interactions.
- **screenshot** — Take a full-page screenshot of any URL after optional interactions. Returns the screenshot URL for visual inspection.
- **search_web** — Search the web via DuckDuckGo. Returns ranked URLs with snippets. Follow up with \`browse\` to visit the best results.

### Supported browser actions (inside \`browse\` and \`screenshot\`)
Actions are performed in order before the page content is captured:
- \`{ "type": "click", "selector": "CSS_SELECTOR" }\` — Click an element by CSS selector
- \`{ "type": "type", "selector": "CSS_SELECTOR", "text": "VALUE" }\` — Type into an input field
- \`{ "type": "wait", "milliseconds": 2000 }\` — Wait N milliseconds for content to load
- \`{ "type": "scroll", "direction": "down", "amount": 500 }\` — Scroll the page
- \`{ "type": "hover", "selector": "CSS_SELECTOR" }\` — Hover over an element (triggers tooltips/dropdowns)
- \`{ "type": "press", "key": "Enter" }\` — Press a keyboard key
- \`{ "type": "select", "selector": "CSS_SELECTOR", "value": "OPTION_VALUE" }\` — Select a dropdown option

---

## TASK STRATEGY

### Phase 1 — Plan before acting
Before performing any actions, briefly assess:
1. What is the task? What page(s) do I need to visit?
2. Are there login/auth requirements? (Note: you can fill login forms if credentials are provided)
3. What is the expected outcome? (data extracted, screenshot taken, form submitted, etc.)
4. What is my step-by-step plan?

### Phase 2 — Navigate and orient
1. Browse to the starting URL.
2. Read the page Markdown carefully to understand the current page structure and available elements.
3. Identify the relevant CSS selectors, links, and form fields.

### Phase 3 — Interact iteratively
Take one logical action group at a time:
- Navigate → read result → identify next action → interact → read result → continue
- Take a screenshot after significant interactions to confirm the browser state visually
- Always wait after actions that trigger navigation or async loading (use \`wait\` action)

### Phase 4 — Extract and report
Synthesise everything you observed into a clear, structured report.

---

## BEST PRACTICES

- **Use CSS selectors precisely**: Prefer `id` selectors (`#submit-btn`) over fragile class chains. Inspect the Markdown for element IDs and names.
- **Wait after interactions**: Clicks that trigger navigation or AJAX need a \`wait\` action immediately after.
- **Take screenshots at key moments**: Use \`screenshot\` after completing significant steps so the result is visually verifiable.
- **Never fabricate results**: Only report what you actually observed from tool outputs. Never hallucinate page content.
- **Handle errors gracefully**: If a selector is not found or a page fails to load, try an alternative approach — different selector, different URL structure, or search for the correct URL first.
- **Search before assuming URLs**: If unsure of a URL, use \`search_web\` first, then browse the best result.

---

## FAILURE RECOVERY

- **Page fails to load** → try \`search_web\` to find the correct URL; try a mirror or alternative domain
- **Selector not found** → read the page Markdown carefully for the correct selector; try a broader selector; try searching the HTML for landmarks
- **Dynamic content not visible** → add a longer \`wait\` action (2000–5000ms); try scrolling down first
- **Form submission fails** → check if there is a CAPTCHA or JS validation; report clearly if blocked
- **Login required** → note the requirement; describe what credentials are needed; stop and report if none provided
- **Paywalled content** → stop immediately; note the paywall; suggest alternatives

---

## OUTPUT FORMAT

Return a structured Markdown report with all sections that apply to the task:

- **Summary**: 2–4 sentence direct answer to what was accomplished or found.
- **Steps performed**: Ordered list of what you did, what was clicked/typed/submitted.
- **Extracted data**: Tables, lists, code blocks, or structured content pulled from the page(s).
- **Screenshots taken**: Reference the screenshot URLs captured for visual confirmation.
- **Errors encountered**: Any failures, blocked elements, or unexpected page states.
- **Recommendations**: Suggested next steps if the task is incomplete or requires human action.

Be precise, factual, and implementation-ready. The main agent will act on your report.`;

// ── Internal tool definitions (only seen by the browser use subagent) ─────────

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const BROWSER_ACTIONS_SCHEMA = {
  type: 'array',
  description: 'Optional ordered list of browser actions to perform before capturing the page. Actions run in sequence.',
  items: {
    type: 'object',
    oneOf: [
      {
        description: 'Click an element by CSS selector.',
        required: ['type', 'selector'],
        properties: {
          type: { type: 'string', const: 'click' },
          selector: { type: 'string', description: 'CSS selector of the element to click.' },
        },
        additionalProperties: false,
      },
      {
        description: 'Type text into an input or textarea.',
        required: ['type', 'selector', 'text'],
        properties: {
          type: { type: 'string', const: 'type' },
          selector: { type: 'string', description: 'CSS selector of the input element.' },
          text: { type: 'string', description: 'Text to type into the element.' },
        },
        additionalProperties: false,
      },
      {
        description: 'Wait a fixed number of milliseconds (e.g. for page load or animations).',
        required: ['type', 'milliseconds'],
        properties: {
          type: { type: 'string', const: 'wait' },
          milliseconds: { type: 'number', description: 'Number of milliseconds to wait (max 10000).' },
        },
        additionalProperties: false,
      },
      {
        description: 'Scroll the page in a direction.',
        required: ['type', 'direction'],
        properties: {
          type: { type: 'string', const: 'scroll' },
          direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction.' },
          amount: { type: 'number', description: 'Pixels to scroll (default 500).' },
        },
        additionalProperties: false,
      },
      {
        description: 'Hover over an element to reveal tooltips or dropdown menus.',
        required: ['type', 'selector'],
        properties: {
          type: { type: 'string', const: 'hover' },
          selector: { type: 'string', description: 'CSS selector of the element to hover over.' },
        },
        additionalProperties: false,
      },
      {
        description: 'Press a keyboard key (e.g. Enter, Escape, Tab, ArrowDown).',
        required: ['type', 'key'],
        properties: {
          type: { type: 'string', const: 'press' },
          key: { type: 'string', description: 'Key name (e.g. "Enter", "Escape", "Tab", "ArrowDown").' },
        },
        additionalProperties: false,
      },
      {
        description: 'Select an option from a <select> dropdown.',
        required: ['type', 'selector', 'value'],
        properties: {
          type: { type: 'string', const: 'select' },
          selector: { type: 'string', description: 'CSS selector of the <select> element.' },
          value: { type: 'string', description: 'The value attribute of the <option> to select.' },
        },
        additionalProperties: false,
      },
    ],
  },
};

const INTERNAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'browse',
      description:
        'Navigate to a URL using a real cloud-hosted browser that fully renders JavaScript, performs browser actions (click, type, scroll, wait, hover, press, select) in sequence, then returns the page as clean Markdown and optionally a screenshot. This is your primary tool for all browser interactions — reading pages, clicking buttons, filling forms, and extracting rendered content.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'Fully-qualified URL (https://...) to navigate to.' },
          actions: BROWSER_ACTIONS_SCHEMA,
          include_screenshot: { type: 'boolean', description: 'If true, also capture and return a screenshot URL (default false).' },
          max_chars: { type: 'number', description: 'Max characters of Markdown content to return (default 40000, max 100000).' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description:
        'Take a full-page screenshot of a URL using a real cloud-hosted browser after performing optional browser actions. Returns the screenshot URL. Use this to visually confirm page state after interactions, or when the task explicitly requires capturing a visual snapshot.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'Fully-qualified URL (https://...) to screenshot.' },
          actions: BROWSER_ACTIONS_SCHEMA,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        'Search the web via DuckDuckGo and return a ranked list of page titles and URLs with snippets. Use to find the correct URL before navigating, or to discover relevant pages when the starting URL is unknown. Always follow up by browsing the best results.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search query.' },
          max_results: { type: 'number', description: 'Number of results (default 8, max 20).' },
        },
        additionalProperties: false,
      },
    },
  },
];

// ── HTML → plain-text ────────────────────────────────────────────────────────

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function httpFetch(url: string, opts?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...opts,
    signal: AbortSignal.timeout(30000),
  });
}

// ── Firecrawl browser executor ───────────────────────────────────────────────

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v1/scrape';

type FirecrawlAction =
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'hover'; selector: string }
  | { type: 'press'; key: string }
  | { type: 'select'; selector: string; value: string };

type FirecrawlScrapeResponse = {
  success: boolean;
  data?: {
    markdown?: string;
    screenshot?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
};

async function firecrawlScrape(opts: {
  url: string;
  actions?: FirecrawlAction[];
  formats: Array<'markdown' | 'screenshot'>;
  maxChars?: number;
}): Promise<{ markdown: string; screenshot?: string; url: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured — the browser tool is unavailable. Report this to the main agent.');
  }

  const body: Record<string, unknown> = {
    url: opts.url,
    formats: opts.formats,
  };
  if (opts.actions && opts.actions.length > 0) {
    body.actions = opts.actions;
  }

  const res = await httpFetch(FIRECRAWL_SCRAPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Firecrawl error (${res.status}) for ${opts.url}: ${errText}`);
  }

  const data = await res.json() as FirecrawlScrapeResponse;
  if (!data.success) {
    throw new Error(`Firecrawl returned success=false for ${opts.url}: ${data.error ?? 'unknown error'}`);
  }

  const maxChars = Math.min(opts.maxChars ?? 40000, 100000);
  const markdown = (data.data?.markdown ?? '').slice(0, maxChars);
  const screenshot = data.data?.screenshot ?? undefined;

  return { markdown, screenshot, url: opts.url };
}

// ── Internal tool executor ───────────────────────────────────────────────────

async function runInternalTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'browse') {
    const url = String(args.url ?? '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('url must start with http:// or https://');
    }
    const actions = Array.isArray(args.actions) ? args.actions as FirecrawlAction[] : [];
    const includeScreenshot = Boolean(args.include_screenshot);
    const maxChars = typeof args.max_chars === 'number' ? args.max_chars : 40000;

    const formats: Array<'markdown' | 'screenshot'> = ['markdown'];
    if (includeScreenshot) formats.push('screenshot');

    const result = await firecrawlScrape({ url, actions, formats, maxChars });
    return {
      url: result.url,
      char_count: result.markdown.length,
      markdown: result.markdown,
      screenshot_url: result.screenshot ?? null,
      actions_performed: actions.length,
    };
  }

  if (name === 'screenshot') {
    const url = String(args.url ?? '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('url must start with http:// or https://');
    }
    const actions = Array.isArray(args.actions) ? args.actions as FirecrawlAction[] : [];

    const result = await firecrawlScrape({ url, actions, formats: ['screenshot', 'markdown'], maxChars: 5000 });
    return {
      url: result.url,
      screenshot_url: result.screenshot ?? null,
      page_summary: result.markdown.slice(0, 500),
      actions_performed: actions.length,
    };
  }

  if (name === 'search_web') {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('query is required');
    const maxResults = Math.min(Number(args.max_results ?? 8), 20);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;

    const res = await httpFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ona-BrowserUse/1.0)', Accept: 'text/html' },
    });
    const html = await res.text();

    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippets: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = snippetRe.exec(html)) !== null) snippets.push(stripHtml(m[1] ?? ''));

    let idx = 0;
    while ((m = linkRe.exec(html)) !== null && results.length < maxResults) {
      let href = m[1] ?? '';
      const title = stripHtml(m[2] ?? '').trim();
      if (href.startsWith('//duckduckgo.com/l/?')) {
        const uddg = new URLSearchParams(href.split('?')[1] ?? '').get('uddg');
        if (uddg) href = decodeURIComponent(uddg);
      }
      if (!href.startsWith('http') || !title) { idx++; continue; }
      results.push({ title, url: href, snippet: snippets[idx] ?? '' });
      idx++;
    }
    return { query, result_count: results.length, results };
  }

  throw new Error(`Unknown browser use internal tool: ${name}`);
}

// ── Internal message types ───────────────────────────────────────────────────

type BrowserUseToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type BrowserUseMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: BrowserUseToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

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

// ── Browser Use agentic loop ─────────────────────────────────────────────────

async function browserUseCall(messages: BrowserUseMessage[]): Promise<{ content: string; toolCalls: BrowserUseToolCall[] }> {
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
      model: BROWSER_USE_MODEL,
      messages,
      tools: INTERNAL_TOOLS,
      tool_choice: 'auto',
      max_tokens: 8192,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Browser Use AI error (${res.status}): ${text}`);
  }

  const json = await res.json() as FireworksNonStreamResponse;
  if (json.error?.message) throw new Error(`Browser Use AI error: ${json.error.message}`);

  const msg = json.choices?.[0]?.message;
  const content = msg?.content ?? '';
  const toolCalls: BrowserUseToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
    id: tc.id ?? crypto.randomUUID(),
    type: 'function',
    function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
  }));

  return { content, toolCalls };
}

function parseArgs(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') as Record<string, unknown>; } catch { return {}; }
}

// ── Internal step label (human-readable label for each tool call) ─────────────

function internalStepLabel(name: string, args: Record<string, unknown>): string {
  const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '');
  const trim = (v: string, max = 50) => (v.length > max ? `${v.slice(0, max)}…` : v);
  const actions = Array.isArray(args.actions) ? args.actions as Array<{ type: string }> : [];

  switch (name) {
    case 'browse': {
      const url = s('url').replace(/^https?:\/\//, '');
      if (actions.length > 0) {
        const types = actions.map(a => a.type).join(', ');
        return `Browsing ${trim(url, 35)} [${types}]`;
      }
      return `Browsing ${trim(url, 52)}`;
    }
    case 'screenshot': {
      const url = s('url').replace(/^https?:\/\//, '');
      return `Screenshotting ${trim(url, 45)}`;
    }
    case 'search_web':
      return s('query') ? `Searching "${trim(s('query'), 45)}"` : 'Searching web';
    default:
      return name.replace(/_/g, ' ');
  }
}

// ── Step callback type ────────────────────────────────────────────────────────

export type BrowserUseStepCallback = (
  event: 'start' | 'complete',
  stepLabel: string,
  error?: boolean,
) => void;

/**
 * Run the full browser use subagent loop for a browser automation task.
 * Called by the main AI via the `call_browser_use` tool.
 * @param task The browser task to complete.
 * @param onStep Optional callback fired as each internal tool call starts and completes.
 */
export async function runBrowserUseSubagent(task: string, onStep?: BrowserUseStepCallback): Promise<string> {
  const messages: BrowserUseMessage[] = [
    { role: 'system', content: BROWSER_USE_SYSTEM_PROMPT },
    { role: 'user', content: task },
  ];

  for (let i = 0; i < BROWSER_USE_MAX_ITERATIONS; i++) {
    const { content, toolCalls } = await browserUseCall(messages);

    if (!toolCalls.length) {
      return content || 'The browser use expert completed the task with no further output.';
    }

    messages.push({ role: 'assistant', content, tool_calls: toolCalls });

    for (const toolCall of toolCalls) {
      const args = parseArgs(toolCall.function.arguments);
      const stepLabel = internalStepLabel(toolCall.function.name, args);
      onStep?.('start', stepLabel);
      let result: unknown;
      try {
        result = await runInternalTool(toolCall.function.name, args);
        onStep?.('complete', stepLabel);
      } catch (err) {
        result = { error: (err as Error).message };
        onStep?.('complete', stepLabel, true);
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result).slice(0, 30000),
      });
    }
  }

  const last = messages.at(-1);
  if (last?.role === 'assistant') return (last as { role: 'assistant'; content: string }).content;
  return 'Browser task complete — agent reached its iteration limit.';
}

// ── Gateway tool exposed to the main AI ──────────────────────────────────────

/**
 * The single tool the main AI has access to.
 * Invoking it kicks off the full browser use subagent internally.
 */
export const callBrowserUseToolDefinition = {
  type: 'function',
  function: {
    name: 'call_browser_use',
    description:
      'Dispatch a browser automation task to the Browser Use Expert subagent. The Browser Use Expert operates a real cloud-hosted browser (fully renders JavaScript/SPAs) and can navigate URLs, click elements, fill forms, scroll, wait for dynamic content, take screenshots, and extract data from any live website. Use whenever the task requires real browser interaction: checking live website states, filling out web forms, extracting data from JS-rendered pages, capturing screenshots of web UIs, automating multi-step web workflows, or verifying that a deployed web feature works correctly. Provide a clear, step-by-step task description including the starting URL and the specific interactions or data to extract. The expert handles all browsing internally and returns a structured report.',
    parameters: {
      type: 'object',
      required: ['task'],
      properties: {
        task: {
          type: 'string',
          description:
            'A clear, specific browser task description including: (1) the starting URL or a description of what to find, (2) any interactions to perform (clicks, form fills, navigation steps), (3) what data to extract or what outcome to confirm. Example: "Go to https://example.com/login, fill the email field (#email) with test@example.com and the password field (#password) with testpass, click the submit button, then return the content of the resulting page and a screenshot."',
        },
      },
      additionalProperties: false,
    },
  },
};

export function isCallBrowserUseTool(name: string): boolean {
  return name === 'call_browser_use';
}
