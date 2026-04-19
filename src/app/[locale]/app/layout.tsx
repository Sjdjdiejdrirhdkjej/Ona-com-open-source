import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getUser } from '@/libs/auth';

export default async function AppLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    redirect(`/${locale}/sign-in`);
  }

  return (
    <div style={{ height: '100dvh', backgroundColor: 'var(--bg)' }}>
      {props.children}
    </div>
  );
}
