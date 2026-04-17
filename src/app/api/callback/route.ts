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

  const codeVerifier = cookieStore.get('oidc_code_verifier')?.value;
  const expectedState = cookieStore.get('oidc_state')?.value;

  if (!codeVerifier || !expectedState) {
    return NextResponse.redirect(new URL('/api/login', req.url));
  }

  cookieStore.delete('oidc_code_verifier');
  cookieStore.delete('oidc_state');

  const config = await client.discovery(
    new URL('https://replit.com/oidc'),
    process.env.REPL_ID!,
  );

  const callbackUrl = `${getBaseUrl(req)}/api/callback`;

  const currentUrl = new URL(req.url);
  const callbackRequest = new URL(callbackUrl);
  callbackRequest.search = currentUrl.search;

  const tokens = await client.authorizationCodeGrant(config, callbackRequest, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
    redirectUri: callbackUrl,
  });

  const claims = tokens.claims();
  if (!claims) {
    return NextResponse.redirect(new URL('/api/login', req.url));
  }

  const session = await getIronSession<AppSession>(cookieStore, sessionOptions);
  session.user = {
    id: String(claims.sub),
    email: (claims.email as string) ?? null,
    firstName: (claims.first_name as string) ?? null,
    lastName: (claims.last_name as string) ?? null,
    profileImageUrl: (claims.profile_image_url as string) ?? null,
  };
  session.accessToken = tokens.access_token;
  session.refreshToken = tokens.refresh_token;
  session.expiresAt = claims.exp;
  await session.save();

  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
  return NextResponse.redirect(new URL(`/${locale}/app`, req.url));
}
