import { NextResponse } from 'next/server';
import { buildReplitLoginUrl, getReplitOidcConfig, getSession, getPrimaryDomain } from '@/libs/ReplitAuth';

export async function GET() {
  try {
    const config = await getReplitOidcConfig();
    const { url, state, codeVerifier } = await buildReplitLoginUrl(config);

    const session = await getSession();
    session.oidcState = state;
    session.codeVerifier = codeVerifier;
    await session.save();

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('Login error:', err);
    const fallback = `https://${getPrimaryDomain()}/sign-in`;
    return NextResponse.redirect(fallback);
  }
}
