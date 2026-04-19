import type { SessionUser } from '@/libs/ReplitAuth';
import { getSession } from '@/libs/ReplitAuth';

export type { SessionUser };

export async function getUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}
