import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/http';

export async function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const isStripeWebhook = request.nextUrl.pathname === '/api/billing/webhook';
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const origin = request.headers.get('origin');
  if (isApi && mutating && origin && !isStripeWebhook) {
    try { if (new URL(origin).origin !== publicOrigin(request.nextUrl.origin)) return NextResponse.json({ error: 'Cross-origin request blocked.' }, { status: 403 }); }
    catch { return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }); }
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (isApi && !isStripeWebhook && contentLength > 16_384) return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  let response = NextResponse.next({ request });
  if (isStripeWebhook || request.nextUrl.pathname === '/api/health') return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Validate/refresh auth claims rather than trusting a cookie's decoded contents.
  await supabase.auth.getClaims();
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
