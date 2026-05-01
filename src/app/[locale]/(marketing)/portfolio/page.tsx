import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

type IPortfolioProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IPortfolioProps) {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Portfolio',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function Portfolio(props: IPortfolioProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await getTranslations({
    locale,
    namespace: 'Portfolio',
  });

  const caseStudies = [
    {
      slug: 'release-readiness',
      title: 'Release Readiness Command Center',
      summary: 'Track open pull requests, failing checks, and blockers before every release cut.',
      outcome: 'Turns multi-hour release triage into a guided daily workflow.',
      tags: ['Background agents', 'GitHub', 'CI signal'],
    },
    {
      slug: 'incident-triage',
      title: 'Incident Triage Automation',
      summary: 'Pull production errors, reproduce issues in isolated environments, and draft fixes with context.',
      outcome: 'Shrinks mean-time-to-first-fix while preserving human approval gates.',
      tags: ['Sentry-style alerts', 'Sandbox execution', 'PR output'],
    },
    {
      slug: 'dependency-remediation',
      title: 'Dependency and CVE Remediation',
      summary: 'Continuously scan repos, apply safe upgrades, run tests, and prepare reviewable patch PRs.',
      outcome: 'Keeps security debt moving without draining sprint capacity.',
      tags: ['Security', 'Automations', 'Regression tests'],
    },
    {
      slug: 'legacy-migration',
      title: 'Legacy Framework Migration',
      summary: 'Migrate framework versions across multiple repositories using consistent execution plans.',
      outcome: 'Standardizes modernization projects that usually stall in backlog.',
      tags: ['Modernization', 'Multi-repo', 'Repeatable playbooks'],
    },
    {
      slug: 'backlog-sweeps',
      title: 'Backlog Sweep Agents',
      summary: 'Pick up scoped tickets on a schedule, implement fixes, and open traceable pull requests overnight.',
      outcome: 'Turns dormant backlog into a managed delivery stream.',
      tags: ['Scheduling', 'Issue sync', 'Autonomous execution'],
    },
    {
      slug: 'docs-and-cleanup',
      title: 'Docs Drift and Cleanup',
      summary: 'Detect stale documentation, dead code paths, and style drift, then propose cleanup patches.',
      outcome: 'Improves developer velocity by keeping repos healthy and current.',
      tags: ['Documentation', 'Static checks', 'Repository hygiene'],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="mb-10 max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Portfolio</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
          Built with purpose: practical agent workflows teams run every week.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
          These examples show how ONA-style background execution translates into concrete delivery outcomes. Each case study focuses on
          reproducibility, reviewability, and clear human control.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {caseStudies.map(study => (
          <Link
            key={study.slug}
            href={`/portfolio/${study.slug}`}
            className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-2)]"
          >
            <h2 className="text-xl font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)]">
              {study.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{study.summary}</p>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{study.outcome}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {study.tags.map(tag => (
                <span key={tag} className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Why this portfolio exists</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          The point is not to showcase demos. It is to document repeatable execution patterns that teams can adapt in their own repositories
          and governance models.
        </p>
      </section>
    </div>
  );
}
