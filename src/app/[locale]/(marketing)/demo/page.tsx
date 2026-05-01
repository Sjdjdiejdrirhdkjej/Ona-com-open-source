import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string }>;
};

export const metadata: Metadata = {
  title: 'Request a demo — ONA',
  description: 'See ONA running in your environment. Walk through automations, governance, and review flows with our team.',
};

const agenda = [
  { step: '01', title: 'Your repos, your stack', body: 'We start with the codebases you actually want agents to work in — not a generic demo repo.' },
  { step: '02', title: 'Live agent run', body: 'Watch an agent pick up a real task, run tests in an isolated VM, and open a pull request you can review.' },
  { step: '03', title: 'Governance walkthrough', body: 'Network controls, scoped credentials, audit trails, and how it all fits inside your VPC.' },
  { step: '04', title: 'Q&A and next steps', body: 'Pricing, rollout plan, security review materials — whatever your team needs to move forward.' },
];

export default async function DemoPage(props: Props) {
  const { locale } = await props.params;
  const { submitted } = await props.searchParams;
  setRequestLocale(locale);

  return (
    <div>
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="mb-6 font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Request a demo
              </p>
              <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-[0.92] tracking-tighter text-[var(--text-primary)]">
                <span className="block">See ONA</span>
                <span className="block">in your stack.</span>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
                Tell us a little about your team and we&apos;ll set up a working session against your repos, with the integrations and controls your security team needs.
              </p>
            </div>

            <form className="rounded-xl border border-[var(--border)] p-6 sm:p-8 lg:col-span-5" action="/api/demo-request" method="post">
              <div className="space-y-5">
                {submitted === 'ok' && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Thanks — we got your request and will reply within one business day.
                  </div>
                )}
                {submitted === 'error' && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    Something went wrong. Please double-check the fields and try again.
                  </div>
                )}
                <label className="block">
                  <span className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Work email</span>
                  <input required type="email" name="email" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="you@company.com" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Company</span>
                  <input required type="text" name="company" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Acme Inc" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Team size</span>
                  <select name="size" className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)] [&>option]:text-zinc-900">
                    <option>1–10 engineers</option>
                    <option>11–50 engineers</option>
                    <option>51–200 engineers</option>
                    <option>200+ engineers</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-mono text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">What would you like to see?</span>
                  <textarea name="notes" rows={4} className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="A migration across our Java services, plus VPC setup." />
                </label>
                <button type="submit" className="w-full rounded-lg bg-[var(--text-primary)] px-5 py-3 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-80">
                  Request a demo →
                </button>
                <p className="text-xs text-[var(--text-muted)]">We reply within one business day. No sales sequences.</p>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
          <p className="mb-8 font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">What the call covers</p>
          <div className="grid rounded-xl border border-[var(--border)] md:grid-cols-2 lg:grid-cols-4">
            {agenda.map(item => (
              <div key={item.step} className="border-b border-[var(--border)] p-6 last:border-b-0 sm:p-8 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--accent)]">{item.step}</p>
                <h3 className="mt-6 text-2xl font-semibold leading-[0.95] tracking-tight text-[var(--text-primary)]">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-[var(--text-secondary)]">
            Prefer to try it yourself first?{' '}
            <Link href="/dashboard" className="underline underline-offset-4 hover:opacity-70">Open the dashboard</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
