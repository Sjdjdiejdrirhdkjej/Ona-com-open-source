import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { GetStartedLink } from '@/components/GetStartedLink';
import { BaseTemplate } from '@/templates/BaseTemplate';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <BaseTemplate
      leftNav={(
        <>
          <li>
            <Link href="/about/" className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]">
              Platform
            </Link>
          </li>
          <li>
            <Link href="/portfolio/" className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]">
              Use cases
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]">
              Models
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]">
              Blog
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]">
              Pricing
            </Link>
          </li>
        </>
      )}
      rightNav={(
        <>
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Sign In
          </Link>
          <GetStartedLink
            className="rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-[var(--bg)] transition-opacity hover:opacity-80"
            locale={locale}
          >
            Get Started
          </GetStartedLink>
        </>
      )}
    >
      {props.children}
    </BaseTemplate>
  );
}
