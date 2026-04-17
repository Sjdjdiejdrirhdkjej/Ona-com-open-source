export const dynamic = 'force-dynamic';

export async function POST() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: 'GitHub not configured' }, { status: 500 });
  }

  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: 'repo user',
    }),
  });

  if (!res.ok) {
    return Response.json({ error: 'Failed to start device flow' }, { status: 500 });
  }

  const data = await res.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  return Response.json(data);
}
