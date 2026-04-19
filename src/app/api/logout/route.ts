import { NextResponse } from 'next/server';
import { getSession, getPrimaryDomain } from '@/libs/ReplitAuth';

export async function GET() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/', `https://${getPrimaryDomain()}`));
}
