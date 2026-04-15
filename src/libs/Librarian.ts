/**
 * Librarian — a read-only intelligence subagent available exclusively to Ona.
 *
 * Inspired by ampcode's librarian and opencode's fetch/search tools.
 * Capabilities:
 *   - Fetch any public URL and return clean readable text
 *   - Look up npm package metadata + README
 *   - Fetch the README of any public GitHub repository
 *   - Search the web via DuckDuckGo and return ranked result links
 *
 * None of these tools are exposed in the UI — they are internal tools the AI
 * uses autonomously to scout documentation and find reference implementations.
 */

// ── HTML → plain-text helpers ────────────────────────────────────────────────

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

async function fetchText(url: string, maxChars = 30000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Ona-Librarian/1.0 (documentation scout; +https://ona.ai)',
      Accept: 'text/html,application/xhtml+xml,text/plain,application/json',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const raw = await res.text();

  const text = contentType.includes('html') ? stripHtml(raw) : raw;
  return text.slice(0, maxChars);
}

// ── Tool definitions ─────────────────────────────────────────────────────────

export const librarianToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'librarian_fetch_url',
      description:
        'Fetch any public URL (documentation page, blog post, spec, changelog, etc.) and return its readable text content. Use this to read library docs, MDN pages, RFC documents, release notes, or any web resource relevant to the task. HTML is automatically stripped to clean text.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            description: 'The fully-qualified URL to fetch (must be publicly accessible).',
          },
          max_chars: {
            type: 'number',
            description: 'Maximum characters to return (default 30000, max 80000).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'librarian_npm_package',
      description:
        'Look up an npm package by name. Returns the latest version, description, homepage, repository URL, license, and README excerpt. Use this to understand a dependency before writing code that uses it, or to find migration guides.',
      parameters: {
        type: 'object',
        required: ['package_name'],
        properties: {
          package_name: {
            type: 'string',
            description: 'The exact npm package name (e.g. "react", "drizzle-orm", "@t3-oss/env-nextjs").',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'librarian_github_readme',
      description:
        'Fetch the README of any public GitHub repository. Useful for understanding how a library works, finding usage examples, or getting reference implementation patterns. Works with any public repo — not just the user\'s own.',
      parameters: {
        type: 'object',
        required: ['owner', 'repo'],
        properties: {
          owner: {
            type: 'string',
            description: 'GitHub username or organization (e.g. "vercel").',
          },
          repo: {
            type: 'string',
            description: 'Repository name (e.g. "next.js").',
          },
          ref: {
            type: 'string',
            description: 'Branch, tag, or commit SHA. Defaults to the repo\'s default branch.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'librarian_search_web',
      description:
        'Search the web for documentation, tutorials, examples, or reference implementations. Returns a ranked list of page titles and URLs. Follow up with librarian_fetch_url to read the most relevant pages in full.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g. "drizzle-orm postgres migrations guide", "Next.js 15 server actions docs").',
          },
          max_results: {
            type: 'number',
            description: 'Number of results to return (default 8, max 20).',
          },
        },
        additionalProperties: false,
      },
    },
  },
];

// ── Tool runner ──────────────────────────────────────────────────────────────

export async function runLibrarianTool(name: string, args: Record<string, unknown>) {
  if (name === 'librarian_fetch_url') {
    const url = String(args.url ?? '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }
    const maxChars = Math.min(Number(args.max_chars ?? 30000), 80000);
    const text = await fetchText(url, maxChars);
    return { url, char_count: text.length, content: text };
  }

  if (name === 'librarian_npm_package') {
    const packageName = String(args.package_name ?? '').trim();
    if (!packageName) throw new Error('package_name is required.');

    const encoded = encodeURIComponent(packageName).replace(/%40/g, '@').replace(/%2F/g, '/');
    const res = await fetch(`https://registry.npmjs.org/${encoded}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`npm registry returned ${res.status} for package "${packageName}".`);
    }

    type NpmManifest = {
      name: string;
      description?: string;
      license?: string;
      homepage?: string;
      repository?: { url?: string } | string;
      'dist-tags'?: { latest?: string };
      versions?: Record<string, { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }>;
      readme?: string;
    };

    const data = await res.json() as NpmManifest;
    const latest = data['dist-tags']?.latest ?? '';
    const versionData = latest ? (data.versions?.[latest] ?? {}) : {};
    const repoUrl = typeof data.repository === 'object' ? data.repository?.url : data.repository;
    const readme = (data.readme ?? '').slice(0, 8000);

    return {
      name: data.name,
      latest_version: latest,
      description: data.description,
      license: data.license,
      homepage: data.homepage,
      repository: repoUrl,
      dependencies: versionData.dependencies ?? {},
      peer_dependencies: versionData.peerDependencies ?? {},
      readme_excerpt: readme,
    };
  }

  if (name === 'librarian_github_readme') {
    const owner = String(args.owner ?? '').trim();
    const repo = String(args.repo ?? '').trim();
    const ref = typeof args.ref === 'string' && args.ref ? args.ref : undefined;

    if (!owner || !repo) throw new Error('owner and repo are required.');

    const refParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme${refParam}`;

    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'Ona-Librarian/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 404) {
      throw new Error(`No README found for ${owner}/${repo}${ref ? ` at ref "${ref}"` : ''}.`);
    }
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status} for ${owner}/${repo} README.`);
    }

    const raw = await res.text();
    const content = raw.slice(0, 40000);

    return {
      repository: `${owner}/${repo}`,
      ref: ref ?? 'default branch',
      char_count: content.length,
      content,
    };
  }

  if (name === 'librarian_search_web') {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('query is required.');
    const maxResults = Math.min(Number(args.max_results ?? 8), 20);

    const encoded = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encoded}&kl=us-en`;

    const html = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Ona-Librarian/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12000),
    }).then(r => r.text());

    const results: Array<{ title: string; url: string; snippet: string }> = [];

    const resultBlockRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    let match: RegExpExecArray | null;
    const snippetMatches: string[] = [];
    while ((match = snippetRe.exec(html)) !== null) {
      snippetMatches.push(stripHtml(match[1] ?? ''));
    }

    let idx = 0;
    while ((match = resultBlockRe.exec(html)) !== null && results.length < maxResults) {
      const rawHref = match[1] ?? '';
      const title = stripHtml(match[2] ?? '').trim();

      let href = rawHref;
      if (href.startsWith('//duckduckgo.com/l/?')) {
        const uddg = new URLSearchParams(href.split('?')[1] ?? '').get('uddg');
        if (uddg) href = decodeURIComponent(uddg);
      }

      if (!href.startsWith('http') || !title) { idx++; continue; }

      results.push({ title, url: href, snippet: snippetMatches[idx] ?? '' });
      idx++;
    }

    return {
      query,
      result_count: results.length,
      results,
      tip: 'Use librarian_fetch_url to read the full content of any result.',
    };
  }

  throw new Error(`Unknown librarian tool: ${name}`);
}

export function isLibrarianTool(name: string): boolean {
  return name.startsWith('librarian_');
}
