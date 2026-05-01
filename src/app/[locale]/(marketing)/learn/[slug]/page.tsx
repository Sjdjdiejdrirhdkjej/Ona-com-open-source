import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { blogPosts, learnEntries } from '../content';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

function getEntry(slug: string) {
  return learnEntries[slug] ?? blogPosts[slug];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = getEntry(slug);
  if (!entry) return {};
  return {
    title: `${entry.title} — ONA`,
    description: entry.intro,
  };
}

export function generateStaticParams() {
  return [...Object.keys(learnEntries), ...Object.keys(blogPosts)].map(slug => ({ slug }));
}

export default async function LearnPage(props: Props) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);

  const entry = getEntry(slug);
  if (!entry) notFound();

  return (
    <div>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:px-8 sm:py-28">
          <p className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">
            {entry.tag}
          </p>
          <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[0.92] tracking-tighter text-[var(--text-primary)]">
            {entry.title}
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)]">
            {entry.intro}
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16">
          <div className="space-y-14">
            {entry.sections.map(section => (
              <div key={section.heading} className="grid gap-6 md:grid-cols-12">
                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-3xl md:col-span-5">
                  {section.heading}
                </h2>
                <div className="md:col-span-7">
                  <p className="text-base leading-relaxed text-[var(--text-secondary)]">
                    {section.body}
                  </p>
                  {section.bullets && (
                    <ul className="mt-5 space-y-2 text-sm text-[var(--text-secondary)]">
                      {section.bullets.map(b => (
                        <li key={b} className="flex gap-3">
                          <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:px-8 sm:py-24">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
            Next step
          </p>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-[0.95] tracking-tighter text-[var(--text-primary)] sm:text-5xl">
            Ready to put this to work?
          </h2>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {entry.cta && (
              <Link
                href={entry.cta.href}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-80"
              >
                {entry.cta.label}
                <span>→</span>
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex justify-center rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
            >
              Back to overview
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
