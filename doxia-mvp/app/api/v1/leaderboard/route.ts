import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { getLeaderboard } from '@/lib/data';
export const GET = publicGet(async ({ supabase, url }) => {
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30) || 30, 1), 365);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 10) || 10, 1), 50);
  const leaders = await getLeaderboard(supabase, days, limit);
  if (!leaders) return failed('rankings');
  return { body: { data: leaders, days, note: 'Members who opted out of rankings are never listed.' } };
});
export const OPTIONS = publicOptions;
