# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 15 App Router project written in TypeScript. Application routes and API handlers live in `src/app`, shared UI in `src/components`, service and integration code in `src/libs`, schema definitions in `src/models`, and reusable helpers in `src/utils`. Locale files are in `src/locales`, global styles in `src/styles`, and public assets in `public`. Database migrations are tracked in `migrations`. Browser and integration coverage live under `tests/e2e` and `tests/integration`.

## Build, Test, and Development Commands
Use Node `22.x` as defined in `package.json`.

- `npm install`: install dependencies.
- `npm run dev`: start the local dev server on port `5000`.
- `npm run build`: create a production build.
- `npm run start`: run the production server on port `5000`.
- `npm run clean`: remove `.next`, `out`, and `coverage`.
- `npm run db:generate`: generate Drizzle migrations after schema changes.
- `npm run db:studio`: open the Drizzle Studio UI.

## Coding Style & Naming Conventions
Follow strict TypeScript settings in `tsconfig.json` and prefer path aliases such as `@/libs/Logger`. ESLint uses the Antfu flat config with Next.js, accessibility, Playwright, and Storybook rules. Use semicolons, keep brace style `1tbs`, and prefer `type` over `interface`. Match existing naming patterns: React components in `PascalCase`, utilities and library modules in `camelCase` or descriptive `PascalCase` filenames, and tests alongside source as `*.test.ts` or `*.test.tsx`.

## Testing Guidelines
Vitest covers unit and UI tests. Name source tests `src/**/*.test.ts` or `src/**/*.test.tsx`; Playwright uses `tests/**/*.spec.ts` and `tests/**/*.e2e.ts`. Keep coverage focused on `src/**/*` and exclude Storybook stories. Run Vitest and Playwright through the project’s configured toolchain before opening a PR, and add tests for new route handlers, utilities, or regressions.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits via commitlint, for example `feat: add GitHub device flow` or `fix: prevent duplicate SSE events`. Keep subjects imperative and scoped when useful. PRs should describe the behavior change, note any schema or env updates, link the related issue, and include screenshots for UI work. If you change migrations, API routes, or auth flows, call that out explicitly in the PR description.
Create a separate commit for every discrete change instead of batching unrelated edits together.

## Security & Configuration Tips
Keep secrets in `.env.local` and never commit credentials. Review changes touching `src/libs/auth.ts`, `src/libs/session.ts`, or `src/app/api/**` carefully, since they affect authentication, sessions, and external integrations.
