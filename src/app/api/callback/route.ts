import { NextResponse, type NextRequest } from 'next/server';
import { authorizationCodeGrant, getReplitOidcConfig, getRedirectUri, getSession, getPrimaryDomain } from '@/libs/ReplitAuth';

export async function GET(request: NextRequest) {
  const baseUrl = `https://${getPrimaryDomain()}`;

  try {
    const session = await getSession();
    const { oidcState, codeVerifier } = session;

    if (!oidcState || !codeVerifier) {
      return NextResponse.redirect(new URL('/sign-in', baseUrl));
    }

    const config = await getReplitOidcConfig();
    const currentUrl = new URL(request.url);

    const tokens = await authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: oidcState,
      expectedRedirectUri: getRedirectUri(),
    });

    const claims = tokens.claims();
    if (!claims) {
      return NextResponse.redirect(new URL('/sign-in', baseUrl));
    }

    session.user = {
      id: claims.sub,
      email: (claims.email as string) ?? null,
      firstName: (claims.first_name as string) ?? null,
      lastName: (claims.last_name as string) ?? null,
      profileImageUrl: (claims.profile_image_url as string) ?? null,
    };
    delete session.oidcState;
    delete session.codeVerifier;
    await session.save();

    return NextResponse.redirect(new URL('/app', baseUrl));
  } catch (err) {
    console.error('OIDC callback error:', err);
    return NextResponse.redirect(new URL('/sign-in', baseUrl));
  }
}
