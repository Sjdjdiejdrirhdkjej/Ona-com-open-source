import { NextResponse } from 'next/server';
import { getSession } from '@/libs/ReplitAuth';

export async function GET() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json(null, { status: 401 });
  }
  return NextResponse.json(session.user);
}
