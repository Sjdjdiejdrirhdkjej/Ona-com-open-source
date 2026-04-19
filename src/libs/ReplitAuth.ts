import {
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  dynamicClientRegistration,
  randomPKCECodeVerifier,
  randomState,
  authorizationCodeGrant,
} from 'openid-client';
import type { Configuration } from 'openid-client';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

const ISSUER_URL = new URL('https://replit.com/oidc');

export type SessionUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

export type OidcSessionData = {
  user?: SessionUser;
  oidcState?: string;
  codeVerifier?: string;
};

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'replit_auth_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
  },
};

let cachedConfig: Configuration | null = null;

export function getPrimaryDomain(): string {
  const raw = process.env.REPLIT_DOMAINS;
  if (!raw) throw new Error('REPLIT_DOMAINS env var is not set');
  return raw.split(',')[0]!.trim();
}

export function getRedirectUri(): string {
  return `https://${getPrimaryDomain()}/api/callback`;
}

export async function getReplitOidcConfig(): Promise<Configuration> {
  if (cachedConfig) return cachedConfig;

  const redirectUri = getRedirectUri();

  const config = await dynamicClientRegistration(
    ISSUER_URL,
    {
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      client_name: 'ONA App',
    },
  );

  cachedConfig = config;
  return config;
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<OidcSessionData>(cookieStore, SESSION_OPTIONS);
}

export async function buildReplitLoginUrl(config: Configuration): Promise<{ url: URL; state: string; codeVerifier: string }> {
  const redirectUri = getRedirectUri();
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = randomState();

  const url = buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { url, state, codeVerifier };
}

export { authorizationCodeGrant };
