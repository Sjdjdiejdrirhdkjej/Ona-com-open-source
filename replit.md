# Next.js Boilerplate on Replit

## Project Overview
A Next.js 15 boilerplate with Turbopack, Tailwind CSS v4, Drizzle ORM, PGLite (local PostgreSQL), next-intl (i18n), and React 19.

## Architecture
- **Framework**: Next.js 15 with App Router and Turbopack
- **Database**: PGLite (embedded PostgreSQL, no Docker needed) — runs as a local socket server (`pglite-server --db=local.db`)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS v4
- **i18n**: next-intl
- **Forms**: React Hook Form + Zod validation
- **Package manager**: npm (with `legacy-peer-deps=true` in `.npmrc`)

## Replit Configuration
- **Dev server**: port 5000, bound to `0.0.0.0` (required for Replit preview)
- **Workflow**: "Start application" runs `npm run dev` (starts PGLite file server + Next.js dev server in parallel)
- **Scripts updated**:
  - `dev:next`: `next dev --turbopack -p 5000 -H 0.0.0.0`
  - `start`: `next start -p 5000 -H 0.0.0.0`

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (defaults to local PGLite at `postgresql://postgres:postgres@127.0.0.1:5432/postgres`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk auth public key
- `CLERK_SECRET_KEY`: Clerk auth secret (put in `.env.local`, not tracked by git)
- `NEXT_PUBLIC_POSTHOG_KEY`: PostHog analytics key (optional)
- `ARCJET_KEY`: Arcjet security key (optional, put in `.env.local`)

## Key Directories
- `src/app/` — Next.js App Router pages
- `src/components/` — Shared UI components
- `src/libs/` — Library configs (Env, I18n, DB)
- `src/models/` — Drizzle schema/models
- `migrations/` — Drizzle migration files

## Development
```bash
npm run dev          # Start dev server + PGLite
npm run build        # Build for production
npm run db:generate  # Generate Drizzle migrations
npm run db:studio    # Open Drizzle Studio
```
