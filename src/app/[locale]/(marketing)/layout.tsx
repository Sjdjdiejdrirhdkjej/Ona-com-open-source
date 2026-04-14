import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
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
            <Link href="/about/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Platform
            </Link>
          </li>
          <li>
            <Link href="/portfolio/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Use cases
            </Link>
          </li>
          <li>
            <Link href="/counter/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Resources
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Blog
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Docs
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-md px-3 py-1.5 hover:bg-black/5 transition-colors">
              Pricing
            </Link>
          </li>
        </>
      )}
      rightNav={(
        <>
          <Link href="/sign-in/" className="px-3 py-1.5 text-gray-700 hover:text-gray-950 transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up/"
            className="rounded-md border border-gray-900 px-3 py-1.5 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
          >
            Request a demo
          </Link>
        </>
      )}
    >
      {props.children}
    </BaseTemplate>
  );
}
