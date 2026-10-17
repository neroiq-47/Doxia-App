import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { publicOrigin } from '@/lib/http';
import type { SupabaseClient } from '@supabase/supabase-js';

// Public developer API: read-only, anonymous (RLS applies as a signed-out visitor), CORS-enabled, rate limited per IP.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, { count: number; reset: number }>();

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimit(ip: string) {
  const now = Date.now();
  if (hits.size > 10_000) for (const [key, value] of hits) if (value.reset < now) hits.delete(key);
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) { hits.set(ip, { count: 1, reset: now + WINDOW_MS }); return { ok: true, remaining: MAX_REQUESTS - 1, reset: now + WINDOW_MS }; }
  entry.count += 1;
  return { ok: entry.count <= MAX_REQUESTS, remaining: Math.max(0, MAX_REQUESTS - entry.count), reset: entry.reset };
}

type Context = { supabase: SupabaseClient; url: URL; origin: string };
export function publicGet<P>(handler: (ctx: Context, params: P) => Promise<{ status?: number; body: unknown }>) {
  return async (request: Request, context: { params: Promise<P> }) => {
    const limit = rateLimit(clientIp(request));
    const headers: Record<string, string> = { ...CORS, 'X-RateLimit-Limit': String(MAX_REQUESTS), 'X-RateLimit-Remaining': String(limit.remaining), 'X-RateLimit-Reset': String(Math.ceil(limit.reset / 1000)) };
    if (!limit.ok) return NextResponse.json({ error: 'Rate limit exceeded. 60 requests per minute per IP.' }, { status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil((limit.reset - Date.now()) / 1000)) } });
    try {
      const url = new URL(request.url);
      const result = await handler({ supabase: createPublicClient(), url, origin: publicOrigin(url.origin) }, await context.params);
      const status = result.status ?? 200;
      return NextResponse.json(result.body, { status, headers: { ...headers, 'Cache-Control': status === 200 ? 'public, max-age=30, s-maxage=30' : 'no-store' } });
    } catch {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 503, headers });
    }
  };
}
export function publicOptions() { return new Response(null, { status: 204, headers: CORS }); }
export const notFound = (what: string) => ({ status: 404, body: { error: `${what} not found.` } });
export const failed = (what: string) => ({ status: 500, body: { error: `Could not load ${what}.` } });
