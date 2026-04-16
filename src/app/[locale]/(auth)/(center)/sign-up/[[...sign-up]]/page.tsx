import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

type ISignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SignUpPage(props: ISignUpPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  redirect('/sign-in');
}
