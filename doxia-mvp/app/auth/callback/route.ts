import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  let destination = '/';
  if (next) {
    try { const candidate = new URL(next, url.origin); if (candidate.origin === url.origin && next.startsWith('/') && !next.startsWith('//')) destination = `${candidate.pathname}${candidate.search}${candidate.hash}`; }
    catch { destination = '/'; }
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));
}
