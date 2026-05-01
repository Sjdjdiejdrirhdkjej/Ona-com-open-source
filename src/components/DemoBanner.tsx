import Link from 'next/link';

export const DemoBanner = () => (
  <div className="sticky top-0 z-50 bg-zinc-900 p-4 text-center text-lg font-semibold text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 [&_a:hover]:text-[var(--accent)] [&_a]:text-indigo-400">
    Live Demo of Next.js Boilerplate -
    {' '}
    <Link href="/sign-up">Explore the Authentication</Link>
  </div>
);
