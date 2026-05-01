'use client';

import { signIn } from '@/libs/auth-client';

type SignInButtonProps = {
  returnTo?: string;
};

export function SignInButton({ returnTo = '/dashboard' }: SignInButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signIn(returnTo)}
      className="flex items-center gap-2.5 rounded-lg bg-[var(--text-primary)] px-6 py-3 text-[15px] font-medium text-[var(--bg)] transition-opacity hover:opacity-80"
    >
      Get started
    </button>
  );
}
