import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { BaseTemplate } from '@/templates/BaseTemplate';
import { UserDropdown } from '@/components/UserDropdown';

export default async function DashboardLayout(props: {
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
            <Link
              href="/dashboard/"
              className="rounded-[4px] px-3 py-1.5 font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              href="/app"
              className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              Open App
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/user-profile"
              className="rounded-[4px] px-3 py-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              Settings
            </Link>
          </li>
        </>
      )}
      rightNav={(
        <UserDropdown />
      )}
    >
      {props.children}
    </BaseTemplate>
  );
}
