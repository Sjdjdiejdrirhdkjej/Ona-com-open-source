import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { SessionProvider } from '@/components/SessionProvider';
import { auth } from '@/libs/auth';

export default async function AppLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect('/sign-in');
  }

  return (
    <SessionProvider initialSession={session}>
      <div style={{ height: '100dvh', backgroundColor: 'var(--bg)' }}>
        {props.children}
      </div>
    </SessionProvider>
  );
}
