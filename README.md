# ONA but OPEN SOURCE

An open-source clone of the [Ona](https://ona.com) platform — a full-stack **AI background software engineering agent**. Users describe tasks in a chat UI, and an autonomous agent uses GitHub, Daytona sandboxes, a Librarian research subagent, an Oracle deep-reasoning subagent, and a Browser Use subagent to deliver changes end-to-end: **task in → pull request out**.

Built with **Next.js 15** (App Router) + **React 19** + **Tailwind CSS 4** + **Drizzle ORM** + **PostgreSQL**, deployed via Replit/Vercel.

---

## ✨ Key Features

- **Autonomous Agent Loop (Ultrawork):** The AI plans with `todo_write`, tracks progress with `todo_read`, and must call `task_complete` to exit. Loop re-injection ensures tasks are fully completed.
- **Daytona Sandboxes:** Isolated cloud development environments for safe code execution (`sandbox_create`, `sandbox_exec`, `sandbox_write_file`, `sandbox_read_file`, `sandbox_list_files`, `sandbox_delete`, `sandbox_git_clone`).
- **GitHub Integration:** Full GitHub API — repos, files, branches, commits, PRs, issues. Enforces branch + PR workflow (no direct pushes to default branch).
- **Subagents:**
  - **Librarian** — Research subagent (up to 15 iterations). Tools: `scrape_page` (Firecrawl), `fetch_url`, `search_web` (DuckDuckGo), `npm_package`, `github_readme`.
  - **Librarian Pro** — Unified research + browser agent replacing both Librarian and Browser Use.
  - **Oracle** — Deep-reasoning subagent (GLM 5.1) for architecture decisions, debugging, and synthesis.
  - **Browser Use** — Browser automation (up to 25 iterations) using accessibility tree navigation.
  - **Editor** — Code editing subagent with its own Fireworks call.
- **Super Agent:** Autonomous background agent with configurable heartbeat intervals for proactive, unsupervised work.
- **Credits System:** 1 credit = 1 cent. Deducted per provider call using `CREDITS_PER_1000_TOKENS` (fallback: 1/1k tokens, 1-credit minimum).
- **API Keys:** Per-user hashed API keys for programmatic access (`Authorization: Bearer <key>`).
- **Streaming Chat UI:** SSE streaming, tool-step visualization, todo panel, @-mention file picker, image upload/paste, model selector, theme toggle.
- **Internationalization (i18n):** Multi-language support (`en`, `fr`) powered by `next-intl` with Crowdin integration.
- **Authentication:** Replit OIDC (PKCE + nonce) + GitHub OAuth device flow for repository access.
- **Health Monitoring:** Built-in `/api/healthz` and `/api/readiness` endpoints checking database, Fireworks AI, Daytona, and Super Agent status.
- **Resilience:** Circuit breaker, resilient API client, graceful shutdown, memory monitoring, and timeout utilities.

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Database** | PostgreSQL (auto-migrates on startup) |
| **AI Provider** | [Fireworks AI](https://fireworks.ai/) |
| **Sandboxes** | [Daytona](https://daytona.io/) |
| **Auth** | Replit OIDC (`openid-client`), GitHub OAuth device flow |
| **Session** | [`iron-session`](https://github.com/vvo/iron-session) (7-day expiry, SameSite=Lax) |
| **Research** | [Firecrawl](https://firecrawl.dev/), DuckDuckGo search |
| **i18n** | [`next-intl`](https://next-intl.dev/) |
| **Testing** | [Vitest](https://vitest.dev/) (unit + browser), [Playwright](https://playwright.dev/) (E2E) |
| **Analytics** | [PostHog](https://posthog.com/) |
| **Security** | [Arcjet](https://arcjet.com/) |

## 🤖 AI Models

Defined in `src/app/api/chat/route.ts` as `ONA_MODELS`. All route through Fireworks AI with a fallback chain; overridable via environment variables.

| Model Key | Model | Purpose |
| :--- | :--- | :--- |
| `ona-max` | GLM 5.1 | Default for accuracy |
| `ona-max-fast` | Kimi K2.5 Turbo | Fastest responses |
| `ona-mini` | DeepSeek V3.2 | Lightweight tasks |
| `ona-hands-off` | — | Super Agent autonomous mode |

## 📥 Installation

### Prerequisites

- **Node.js 22+**
- **npm** (with `legacy-peer-deps=true` — see `.npmrc`)
- **PostgreSQL** database

### Step 1: Clone the Repository

```bash
git clone https://github.com/Sjdjdiejdrirhdkjej/Ona-com-open-source.git
cd Ona-com-open-source
```

### Step 2: Install Dependencies

```bash
npm install
```

> **On Replit:** Use the Replit package installer instead of raw `npm install` to avoid `ENOTEMPTY` errors. See `replit.md` for details.

### Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# ── Database (tried in order) ──
POSTGRES_URL=postgresql://user:password@host:5432/dbname
# POSTGRES_PRISMA_URL=
# POSTGRES_URL_NON_POOLING=
# POSTGRES_DATABASE_URL=
# DATABASE_URL=

# ── Session ──
SESSION_SECRET=your-32-plus-character-secret

# ── AI (required) ──
FIREWORKS_API_KEY=your_fireworks_key

# ── Sandboxes ──
DAYTONA_API_KEY=your_daytona_key

# ── Research / Browser ──
FIRECRAWL_API_KEY=your_firecrawl_key

# ── GitHub OAuth device flow ──
GITHUB_CLIENT_ID=your_github_client_id

# ── Credits (optional) ──
CREDITS_PER_1000_TOKENS=10

# ── Analytics (optional) ──
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

See `src/libs/Env.ts` for the full list of environment variables and optional model overrides (`FIREWORKS_MODEL`, `FIREWORKS_BROWSER_MODEL`, `FIREWORKS_LIBRARIAN_MODEL`, `FIREWORKS_FALLBACK_MODELS`).

### Step 4: Database Migrations

Migrations are **auto-applied at runtime** (not during `next build`). To generate new migrations after schema changes:

```bash
npm run db:generate
```

To inspect the database interactively:

```bash
npm run db:studio
```

## 💻 Development

Start the development server:

```bash
npm run dev
```

The application runs on **port 5000**, host **0.0.0.0** (required for Replit preview).

### Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js dev server with Turbopack |
| `npm run build` | Generate a production-optimized build |
| `npm run start` | Launch the production server |
| `npm run clean` | Remove `.next`, `out`, and `coverage` |
| `npm run db:generate` | Generate DB migrations from `src/models/Schema.ts` |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |
| `npx vitest` | Run unit and integration tests |
| `npx eslint --fix .` | Lint and auto-fix code |
| `npx playwright test` | Run end-to-end browser tests |

> **Note:** Linting and type-checking run automatically on commit via [lefthook](./lefthook.yml).

## 📂 Project Structure

```text
.
├── migrations/          # Database schema migrations (auto-applied at runtime)
├── scripts/            # Utility scripts (e.g. post-merge hook)
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (auth)/        # Sign-in, sign-up, dashboard
│   │   │   ├── (marketing)/   # Landing pages (home, about, portfolio)
│   │   │   ├── app/           # Main chat UI, API docs, Super Agent page
│   │   │   └── sandbox-modify/# Per-sandbox env var editor
│   │   ├── api/
│   │   │   ├── chat/          # Central agent endpoint (Ultrawork loop)
│   │   │   ├── conversations/ # Conversation CRUD + Super Agent
│   │   │   ├── credits/       # Credit balance
│   │   │   ├── github/        # GitHub OAuth device flow
│   │   │   ├── jobs/          # Background job SSE event stream
│   │   │   ├── sandbox/       # Daytona sandbox file listing
│   │   │   ├── settings/      # Per-user API key management
│   │   │   ├── auth/          # Current user info
│   │   │   ├── healthz/       # Health check endpoint
│   │   │   └── readiness/     # Readiness probe
│   │   ├── global-error.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/      # Shared React components (analytics, auth, theme, etc.)
│   ├── libs/            # Core libraries & services
│   │   ├── Daytona.ts   # Sandbox tools
│   │   ├── GitHub.ts    # GitHub API & tool definitions
│   │   ├── Librarian.ts # Research subagent
│   │   ├── LibrarianPro.ts # Unified research + browser subagent
│   │   ├── Oracle.ts    # Deep-reasoning subagent
│   │   ├── BrowserUse.ts # Browser automation subagent
│   │   ├── Editor.ts    # Code editing subagent
│   │   ├── SuperAgent.ts # Autonomous background agent with heartbeat
│   │   ├── Credits.ts   # Credit deduction logic
│   │   ├── DB.ts        # Drizzle + PostgreSQL connection
│   │   ├── session.ts   # iron-session configuration
│   │   ├── auth.ts      # Auth utilities
│   │   ├── ApiKeys.ts   # API key hashing & verification
│   │   ├── Arcjet.ts    # Rate limiting & security
│   │   ├── HealthCheck.ts # Health & readiness checks
│   │   ├── CircuitBreaker.ts # Circuit breaker pattern
│   │   ├── ResilientApi.ts  # Retry-aware API client
│   │   ├── GracefulShutdown.ts # Graceful process shutdown
│   │   ├── MemoryMonitor.ts  # Memory usage monitoring
│   │   ├── Timeout.ts   # Timeout utility
│   │   ├── Logger.ts    # Structured logging
│   │   ├── I18n.ts      # Internationalization config
│   │   └── Env.ts       # Centralized env var access
│   ├── locales/         # i18n JSON files (only edit en.json; fr.json is Crowdin-managed)
│   ├── models/          # Database schemas (Schema.ts)
│   ├── styles/          # Global CSS (Tailwind)
│   ├── templates/       # Page layout templates
│   ├── types/           # Global TypeScript definitions
│   └── utils/           # Utility functions & app config
├── tests/
│   ├── e2e/             # Playwright end-to-end tests
│   └── integration/     # Integration tests
└── .storybook/          # Storybook component documentation
```

## 🔐 Authentication

### Replit OIDC (Primary)

Uses `openid-client` with PKCE + nonce against `https://replit.com/oidc`. Session stored in an iron-session cookie (`replit_auth_session`, SameSite=Lax, 7-day expiry).

- **Mobile:** Opens Replit sign-in in a separate tab, polls `/api/auth/user?optional=1`.
- **Desktop:** Direct redirect to `/api/login?returnTo=...`.
- **Completion signals:** BroadcastChannel + localStorage.

### GitHub OAuth Device Flow

For repository access. Start → poll → disconnect via `/api/github/device/`. Token persisted in session cookie + `user_github_tokens` table.

### Middleware

`src/middleware.ts` protects `/app` (requires `replit_session` cookie), redirects authenticated users from marketing root to `/app`. **API routes bypass middleware entirely.**

## ⚡ Ultrawork Agent Loop

The core agent loop in `src/app/api/chat/route.ts`:

1. **Start:** AI calls `todo_write` with a full step breakdown (first step `in_progress`, rest `pending`).
2. **During:** After each step, AI calls `todo_write` to update progress (mark `done` / `in_progress`).
3. **Finish:** When all steps are complete, AI calls `todo_write` with everything `done`, then calls `task_complete` with a summary.

**Loop protections:**
- `task_complete` is the **only exit** — the system re-injects the AI if it stops with pending todos.
- **Loop detection:** Stops if 3 consecutive tool-call batches are identical.
- **Intent-without-action detection:** Catches narrated plans with no actual tool calls.
- **Anti-cutoff:** `finish_reason=length` auto-injects a continuation turn.

**Background execution:** The agent loop runs as a detached server-side async. If the tab closes, work continues. State persists in `agent_jobs` + `agent_events`. Page reload replays events via `/api/jobs/[jobId]/events`.

## 💰 Credits System

- 1 credit = 1 cent (USD).
- Deducted on each provider call using `CREDITS_PER_1000_TOKENS` env var (default fallback: 1 credit per 1,000 tokens, 1-credit minimum).
- Signup credits configurable via `SIGNUP_CREDITS` env var.
- Balance accessible via `/api/credits/balance`.

## 🗄️ Database Schema

Defined in `src/models/Schema.ts` with Drizzle ORM. Key tables:

| Table | Purpose |
| :--- | :--- |
| `conversations` | Chat conversation history |
| `messages` | Conversation messages (roles: `user`, `assistant`, `tool_steps`) |
| `agent_jobs` | Background agent jobs (status: `running`, `done`, `error`) |
| `agent_events` | Job progress events (sandbox boot, tool calls, content, errors, completion) |
| `user_github_tokens` | Persisted GitHub OAuth tokens |
| `api_keys` | Per-user hashed API keys |
| `user_credits` | User credit balances |
| `counter` | General-purpose counter |

Migrations in `./migrations/` are auto-applied at runtime. **Migrations are skipped during `next build`.** The build uses a proxy when no database URL is configured.

## 🌐 Internationalization

- Uses `next-intl` with `[locale]` routing (`as-needed` prefix — `/app` works without prefix).
- Locales: `en` (default), `fr`.
- **Only edit `src/locales/en.json`** — `fr.json` is auto-generated by Crowdin.

## ⚠️ Gotchas

- **Port 5000, host 0.0.0.0** — required for Replit preview. Don't change.
- **`@next/swc-linux-x64-gnu`** must match the Next.js version exactly (optional dependency in `package.json`).
- **Never direct-push to default branch** — `GitHub.ts` enforces branch + PR unless explicitly requested.
- **DB migrations skip during `next build`** — runtime fails explicitly if no supported DB URL is configured.
- **Theme hydration** — applied client-side via `ThemeInitializer.tsx` to avoid server/client attribute mismatches.
- **On Replit, don't use raw `npm install`** — use the Replit package installer (see `replit.md`).
- **SSE stream drops** — the client replays persisted events from the beginning to avoid duplicate text.
- **Vercel build** — uses `npm install --legacy-peer-deps` + `npm run build`. No local DB started during build.

## 📜 Attribution

This project was originally scaffolded from the [Next.js Boilerplate](https://github.com/ixartz/Next-js-Boilerplate) by [Ixartz](https://github.com/ixartz).

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2025 Remi W.

---

Built with ❤️ by the ONA but OPEN SOURCE contributors.
