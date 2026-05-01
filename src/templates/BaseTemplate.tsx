import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileMenu } from '@/components/MobileMenu';
import { AppConfig } from '@/utils/AppConfig';

const footerLinks = [
  {
    heading: 'Platform',
    links: ['Background agents', 'Automations', 'Environments', 'Integrations', 'Governance', 'Pricing'],
  },
  {
    heading: 'Use cases',
    links: ['AI code review', 'Backlog tickets', 'Bug triage', 'Code migration', 'CVE remediation', 'Docs drift'],
  },
  {
    heading: 'Compare',
    links: ['Claude Code', 'Cursor', 'GitHub Copilot', 'Devin', 'Codex', 'Factory'],
  },
  {
    heading: 'Resources',
    links: ['Blog', 'Docs', 'Changelog', 'Events', 'Newsletter', 'Templates', 'Reports', 'Skills'],
  },
  {
    heading: 'Company',
    links: ['About', 'Careers', 'Media', 'Contact'],
  },
];

export const BaseTemplate = (props: {
  leftNav: React.ReactNode;
  rightNav?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] antialiased">
      <header
        className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-header)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6 sm:px-8">
          <Link href="/" className="flex-shrink-0">
            <span className="text-lg font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              {AppConfig.name}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden md:flex">
            <ul className="flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)]">
              {props.leftNav}
            </ul>
          </nav>

          {/* Desktop right actions */}
          <div className="hidden items-center gap-2 text-sm md:flex">
            <ThemeToggle />
            {props.rightNav}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <MobileMenu />
          </div>
        </div>
      </header>

      <main className="pt-12">{props.children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-6 pt-12 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5">
            {footerLinks.map(col => (
              <div key={col.heading}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  {col.heading}
                </p>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link}>
                      <Link
                        href="/about/"
                        className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-6 text-xs text-[var(--text-muted)]">
            <span suppressHydrationWarning>{`© ${new Date().getFullYear()} ${AppConfig.name}`}</span>
            <div className="flex flex-wrap gap-3">
              {['Status', 'Security', 'Imprint', 'Terms of service', 'Privacy policy', 'Cookie policy'].map(
                item => (
                  <Link key={item} href="/about/" className="transition-colors hover:text-[var(--text-secondary)]">
                    {item}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
