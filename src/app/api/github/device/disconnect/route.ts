import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

import type { AppSession } from '@/libs/session';
import { sessionOptions } from '@/libs/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  session.githubToken = undefined;
  await session.save();
  return Response.json({ ok: true });
}
