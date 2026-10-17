import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { getCommunityStats } from '@/lib/data';
export const GET = publicGet(async ({ supabase }) => {
  const stats = await getCommunityStats(supabase);
  return stats ? { body: { data: stats } } : failed('community stats');
});
export const OPTIONS = publicOptions;
