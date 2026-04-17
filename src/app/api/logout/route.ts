import * as client from 'openid-client';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { AppSession } from '@/libs/session';
import { sessionOptions } from '@/libs/session';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: Request): string {
  const host = req.headers.get('host') ?? '';
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const protocol = forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  session.destroy();

  const config = await client.discovery(
    new URL('https://replit.com/oidc'),
    process.env.REPL_ID!,
  );

  const endSessionUrl = client.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: getBaseUrl(req),
  });

  return NextResponse.redirect(endSessionUrl.href);
}
