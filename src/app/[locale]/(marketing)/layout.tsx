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
            <Link href="/about/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Platform
            </Link>
          </li>
          <li>
            <Link href="/portfolio/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Use cases
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Resources
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Blog
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Docs
            </Link>
          </li>
          <li>
            <Link href="/about/" className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5">
              Pricing
            </Link>
          </li>
        </>
      )}
      rightNav={(
        <>
          <GetStartedLink
            className="rounded-[4px] bg-neutral-950 px-3 py-1.5 text-white transition-opacity hover:opacity-80 dark:bg-neutral-100 dark:text-neutral-950"
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
