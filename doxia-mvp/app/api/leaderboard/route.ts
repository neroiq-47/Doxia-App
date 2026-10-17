import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
import { getLeaderboard } from '@/lib/data';
export async function GET(request: Request) {
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days') ?? 30) || 30, 1), 365);
  const leaders = await getLeaderboard(await createClient(), days, 10);
  if (!leaders) return jsonError('Could not load rankings.', 500);
  return jsonOk({ days, leaders });
}
