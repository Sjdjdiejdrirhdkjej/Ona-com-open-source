# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ONA but OPEN SOURCE — a full-stack AI coding agent application. Users describe tasks, and an autonomous agent (ONA) uses GitHub API, Daytona sandboxes, a Librarian research subagent, and a Browser Use subagent to complete them end-to-end (task in → pull request out). Built with Next.js 15 App Router, React 19, Tailwind CSS 4, Drizzle ORM, and PostgreSQL.

## Commands

- `npm run dev` — Start dev server on port 5000 (with Turbopack)
- `npm run build` — Production build
- `npm run start` — Start production server on port 5000
- `npm run db:generate` — Generate Drizzle migrations from `src/models/Schema.ts`
- `npm run db:studio` — Open Drizzle Studio
- `npm run lint` — ESLint (uses @antfu/eslint-config with Next.js plugin; auto-fixes on commit via lefthook)
- `npm run test` — Vitest (unit tests in `src/**/*.test.ts`, UI tests in `**/*.test.tsx` with Playwright browser)
- `npm run test:e2e` — Playwright E2E tests
- `npm run storybook` — Storybook component docs
- `npm run clean` — Remove `.next`, `out`, `coverage`

Linting and type-checking run automatically on commit via lefthook pre-commit hooks.

## Architecture

### App Router Structure

- `src/app/[locale]/app/` — Main chat UI (the agent interface)
- `src/app/[locale]/(marketing)/` — Landing pages (home, about, portfolio)
- `src/app/[locale]/(auth)/` — Auth pages (sign-in, sign-up, dashboard)
- `src/app/api/` — All API routes

### Core API Routes

- `api/chat/route.ts` — Central agent endpoint. Runs an agentic loop with Fireworks AI models, streaming SSE events back to the client. Handles tool calls for GitHub, Daytona, Librarian, Browser Use, and Ultrawork (todo/task tracking). This is the largest and most critical file in the project.
- `api/conversations/` — CRUD for conversation history, persisted in PostgreSQL
- `api/jobs/[jobId]/events/` — SSE event stream for background job progress
- `api/github/device/` — GitHub OAuth device flow (start, poll, disconnect)
- `api/login`, `api/callback`, `api/logout` — Replit OIDC auth flow
- `api/auth/user/` — Current user info
- `api/sandbox/files/` — List files in a Daytona sandbox

### Key Libraries (`src/libs/`)

- **Daytona.ts** — Daytona sandbox SDK wrapper. Defines `sandbox_*` tools (create, exec, write_file, read_file, list_files, delete, git_clone). Each tool has a definition (for the AI's tool schema) and a runner function.
- **GitHub.ts** — Full GitHub API wrapper. Defines `github_*` tools for repos, files, branches, commits, PRs, issues, and cloning. Reads token from iron-session cookie, falling back to `user_github_tokens` DB table. Enforces no-push-to-default-branch by default.
- **Librarian.ts** — Research subagent. Runs its own agentic loop (up to 15 iterations) against Fireworks AI with tools: `scrape_page` (Firecrawl), `fetch_url`, `search_web` (DuckDuckGo), `npm_package`, `github_readme`. Exposed to the main AI as a single `call_librarian` tool.
- **BrowserUse.ts** — Browser automation subagent. Opens a Firecrawl CDP session, connects Playwright, runs up to 25 iterations with tools: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press`, `browser_scroll`, `browser_select`, `browser_screenshot`, `search_web`. Uses accessibility tree representation (no vision model needed). Exposed as `call_browser_use`.
- **DB.ts** — Drizzle ORM connection to PostgreSQL. Auto-migrates on startup. Uses global scope caching to prevent hot-reload duplicates. Falls back to a build-time proxy when no DB URL is available during `next build`.
- **session.ts** — Iron-session configuration. Cookie name `replit_session`, stores user info + GitHub token. 7-day expiry.
- **auth.ts** — Helper to get the current iron-session.
- **Env.ts** — Centralized env var access (no validation library, just reads `process.env`).

### Agent System (Ultrawork Loop)

The chat API runs an "ultrawork" loop: the AI plans tasks with `todo_write`, tracks progress with `todo_read`, and must call `task_complete` to exit. The loop re-injects the AI if it stops with pending todos. Loop detection stops the agent if 3 consecutive tool-call batches are identical. Intent-without-action detection catches cases where the model narrates a plan without actually calling tools.

### AI Models

Defined in `ONA_MODELS` in `chat/route.ts`: `ona-max` (GLM 5.1), `ona-max-fast` (Kimi K2.5 Turbo, default), `ona-mini` (DeepSeek V3.2). All route through Fireworks AI API with model fallback chain.

### Database Schema (`src/models/Schema.ts`)

Tables: `user_github_tokens`, `counter`, `conversations`, `messages`, `agent_jobs`, `agent_events`. Migrations auto-applied from `./migrations/`.

### Authentication

Dual auth system:
1. **Replit OIDC** — Primary login via `openid-client` PKCE flow to `replit.com/oidc`. Session stored in iron-session cookie.
2. **GitHub Device Flow** — For repo access. Token stored in session cookie + persisted to `user_github_tokens` DB table.

Middleware (`src/middleware.ts`) protects `/app` routes (requires `replit_session` cookie) and redirects authenticated users from marketing root to `/app`. API routes bypass middleware entirely.

### i18n

`next-intl` with `as-needed` locale prefix. Languages: `en` (default), `fr`. Locale files in `src/locales/`. Crowdin handles translations (only edit English; French is auto-generated).

### Frontend

The main app page (`src/app/[locale]/app/page.tsx`) is a single ~2100-line client component. It handles:
- Conversation sidebar with search and rename
- Real-time SSE streaming with polling fallback (for proxied environments)
- Tool step visualization with expandable sub-steps and librarian/browser reports
- Todo panel for the Ultrawork loop
- @-mention file picker for sandbox files
- Image upload/paste support
- Model selector (ona-max, ona-max-fast, ona-mini)
- Theme toggle (light/dark)

### TypeScript & Linting

Strict mode with `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`/`noUnusedParameters`. ESLint uses `@antfu/eslint-config` with Next.js, JSX a11y, Jest DOM, Playwright, and Storybook plugins. Rule overrides: allow top-level await, use `type` not `interface`, 1tbs brace style.

### Environment Variables

Key env vars: `DATABASE_URL`/`POSTGRES_URL`, `SESSION_SECRET`, `FIREWORKS_API_KEY`, `DAYTONA_API_KEY`, `FIRECRAWL_API_KEY`, `GITHUB_CLIENT_ID`. See `src/libs/Env.ts` for the full list. Sensitive values go in `.env.local` (gitignored).
