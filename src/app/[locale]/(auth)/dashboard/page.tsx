import { redirect } from 'next/navigation';
import Link from 'next/link';
import { count, desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getUser } from '@/libs/auth';
import { getDb } from '@/libs/DB';
import { conversationsSchema, userCreditsSchema, apiKeysSchema } from '@/models/Schema';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('meta_title') };
}

function formatCredits(n: number) {
  return new Intl.NumberFormat().format(n);
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(firstName: string | null, lastName: string | null, email: string | null): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase().replace(/\s/g, '') || '?';
  return (email ?? '?').charAt(0).toUpperCase();
}

function getDisplayName(firstName: string | null, lastName: string | null, email: string | null): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || email || 'there';
}

export default async function Dashboard(props: Props) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    redirect('/sign-in?returnTo=/dashboard');
  }

  const db = await getDb();

  const [
    creditsRows,
    [convCount],
    [keyCount],
    recentConversations,
  ] = await Promise.all([
    db.select().from(userCreditsSchema).where(eq(userCreditsSchema.userId, user.id)).limit(1),
    db.select({ value: count() }).from(conversationsSchema).where(eq(conversationsSchema.userId, user.id)),
    db.select({ value: count() }).from(apiKeysSchema).where(eq(apiKeysSchema.userId, user.id)),
    db.select().from(conversationsSchema).where(eq(conversationsSchema.userId, user.id)).orderBy(desc(conversationsSchema.updatedAt)).limit(6),
  ]);

  const credits = creditsRows[0]?.credits ?? 0;
  const totalConversations = convCount?.value ?? 0;
  const totalApiKeys = keyCount?.value ?? 0;

  const displayName = getDisplayName(user.firstName, user.lastName, user.email);
  const initials = getInitials(user.firstName, user.lastName, user.email);

  const stats = [
    {
      label: 'Credits remaining',
      value: formatCredits(credits),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 L3 14 H12 L11 22 L21 10 H12 L13 2 Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
        </svg>
      ),
      warn: credits <= 0,
      href: '/dashboard/user-profile',
    },
    {
      label: 'Total conversations',
      value: String(totalConversations),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      warn: false,
      href: '/app',
    },
    {
      label: 'API keys',
      value: String(totalApiKeys),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      warn: false,
      href: '/dashboard/user-profile',
    },
  ];

  const quickActions = [
    {
      title: 'Start a new task',
      description: 'Open the agent and describe what you need built.',
      href: '/app',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      primary: true,
    },
    {
      title: 'Super Agent',
      description: 'Configure autonomous heartbeat agents for background work.',
      href: '/app/super-agent',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2 L3 14 H12 L11 22 L21 10 H12 L13 2 Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      primary: false,
    },
    {
      title: 'API Documentation',
      description: 'Explore and test ONA REST APIs directly in your browser.',
      href: '/app/api-docs',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      primary: false,
    },
    {
      title: 'Account Settings',
      description: 'Manage your profile, appearance, credits, and API keys.',
      href: '/dashboard/user-profile',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
      primary: false,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

      {/* ── Welcome header ── */}
      <div className="mb-10 flex items-center gap-4">
        {user.profileImageUrl
          ? (
              <img
                src={user.profileImageUrl}
                alt={displayName}
                className="size-12 rounded-full object-cover ring-2 ring-black/8 dark:ring-white/10"
              />
            )
          : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-base font-semibold text-white dark:text-neutral-900">
                {initials}
              </span>
            )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Welcome back,
            {' '}
            {displayName}
          </h1>
          {user.email && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className={[
              'flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-black/20 dark:hover:border-white/20',
              stat.warn
                ? 'border-red-400/40 bg-red-500/5 dark:border-red-400/30'
                : 'border-black/8 dark:border-white/10',
            ].join(' ')}
            style={{ backgroundColor: stat.warn ? undefined : 'var(--bg-card)' }}
          >
            <span className={stat.warn ? 'text-red-500' : 'text-neutral-500 dark:text-neutral-400'}>
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className={[
                'text-2xl font-semibold tabular-nums tracking-tight',
                stat.warn ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-50',
              ].join(' ')}>
                {stat.value}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(action => (
            <Link
              key={action.title}
              href={action.href}
              className={[
                'flex flex-col gap-3 rounded-xl border p-5 transition-colors',
                action.primary
                  ? 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100'
                  : 'border-black/8 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20',
              ].join(' ')}
              style={action.primary ? undefined : { backgroundColor: 'var(--bg-card)' }}
            >
              <span className={action.primary ? 'text-white dark:text-neutral-900' : 'text-neutral-500 dark:text-neutral-400'}>
                {action.icon}
              </span>
              <div>
                <p className={[
                  'text-sm font-semibold',
                  action.primary ? '' : 'text-gray-900 dark:text-gray-50',
                ].join(' ')}>
                  {action.title}
                </p>
                <p className={[
                  'mt-1 text-xs leading-snug',
                  action.primary ? 'text-white/70 dark:text-neutral-600' : 'text-gray-500 dark:text-gray-400',
                ].join(' ')}>
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent conversations ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Recent conversations</h2>
          <Link href="/app" className="text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-100">
            View all →
          </Link>
        </div>

        {recentConversations.length === 0
          ? (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-black/12 py-14 dark:border-white/12"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-neutral-300 dark:text-neutral-600">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm text-gray-400 dark:text-gray-500">No conversations yet</p>
                <Link
                  href="/app"
                  className="rounded-md bg-neutral-950 px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80 dark:bg-neutral-100 dark:text-neutral-950"
                >
                  Start your first task
                </Link>
              </div>
            )
          : (
              <div className="divide-y divide-black/6 rounded-xl border border-black/8 dark:divide-white/8 dark:border-white/10" style={{ backgroundColor: 'var(--bg-card)' }}>
                {recentConversations.map(conv => (
                  <Link
                    key={conv.id}
                    href={`/app?conversationId=${conv.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{conv.title}</span>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {timeAgo(conv.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
