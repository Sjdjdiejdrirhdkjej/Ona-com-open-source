# Ona-com-open-source

A comprehensive, **open-source full-stack application** inspired by the [Ona](https://ona.com) platform. This project serves as a production-ready foundation for building modern web applications, featuring a robust frontend, a scalable backend, and integrated developer tooling.

## 🚀 Overview

**Ona-com-open-source** is a high-performance, full-stack application built with the latest web technologies. It provides a complete end-to-end solution including localized routing, a type-safe database layer, authentication scaffolding, and an automated testing suite.

### Key Features

- **Next.js 15 (App Router):** Leveraging React 19 server components and optimized rendering.
- **Full-Stack Architecture:** Integrated frontend and backend logic with seamless data flow.
- **Tailwind CSS 4:** Modern, utility-first styling for a sleek and responsive user interface.
- **Internationalization (i18n):** Native multi-language support (`en`, `fr`) powered by `next-intl`.
- **Type-Safe Database:** Database operations using **Drizzle ORM** with **PGlite** for instant local development and PostgreSQL for production.
- **Authentication:** Pre-configured authentication flows for secure user management (Clerk-ready).
- **Quality Assurance:** 
  - **Testing:** Comprehensive unit/integration tests with Vitest and E2E testing with Playwright.
  - **Storybook:** Isolated component development environment.
  - **Linting:** Professional-grade ESLint and formatting standards.
- **Security & Analytics:** Built-in integration for Arcjet (security), Sentry (monitoring), and PostHog (analytics).

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [Next.js 15](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) |
| **Database** | [PGlite](https://pglite.dev/) (Local), PostgreSQL (Remote) |
| **Auth** | [Clerk](https://clerk.com/) (Optional) |
| **Testing** | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) |
| **Monitoring** | [Sentry](https://sentry.io/), [PostHog](https://posthog.com/) |

## 📥 Installation

Follow these steps to get the application running on your local machine.

### Prerequisites

- **Node.js 22+**
- **npm** (or your preferred package manager)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Sjdjdiejdrirhdkjej/Ona-com-open-source.git
cd Ona-com-open-source
```

### Step 2: Install Dependencies

```bash
npm install
```

## ⚙️ Setup & Configuration

### Environment Variables

The project uses `@t3-oss/env-nextjs` for type-safe environment variables. 

1. Create a `.env.local` file in the root directory.
2. Add your sensitive configuration values.

Example `.env.local`:
```env
# Database (Defaults to PGlite if not provided)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Analytics (PostHog)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Security (Arcjet)
ARCJET_KEY=your_arcjet_key
```

### Database Management

The application is pre-configured with **PGlite**, allowing you to start developing immediately without an external database.

To update the application schema:
1. Modify `src/models/Schema.ts`.
2. Generate migrations: `npm run db:generate`.
3. Migrations are automatically applied during the development cycle.

## 💻 Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5000` (Default port specified in `package.json`).

### Useful Commands

- `npm run build` - Generate a production-optimized build.
- `npm run start` - Launch the production server.
- `npm run lint` - Execute ESLint code quality checks.
- `npm run test` - Run unit and integration tests.
- `npm run test:e2e` - Run end-to-end browser tests.
- `npm run storybook` - Open the component documentation portal.

## 📂 Project Structure

```text
.
├── .github          # CI/CD Workflows & GitHub Actions
├── .storybook       # Storybook UI Documentation
├── migrations       # Database Schema Migrations
├── public           # Static Assets & Media
├── src
│   ├── app          # Next.js App Router (Pages & API Routes)
│   ├── components   # Modular React Components
│   ├── libs         # Library & Service Configurations
│   ├── locales      # Localization JSON Files
│   ├── models       # Database Schemas & Data Models
│   ├── styles       # Global Styling & Tailwind Config
│   ├── templates    # Page Layout Templates
│   ├── types        # Global TypeScript Definitions
│   └── utils        # Utility Functions & Application Config
└── tests            # Comprehensive Test Suites
```

## 📜 Credits

This project was originally scaffolded from the [Next.js Boilerplate](https://github.com/ixartz/Next-js-Boilerplate) by [Ixartz](https://github.com/ixartz).

---

Built with ❤️ by the Ona-com-open-source contributors.
