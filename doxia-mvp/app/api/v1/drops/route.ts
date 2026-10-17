import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { listDrops, parseDropFilters, publicDrop } from '@/lib/data';
export const GET = publicGet(async ({ supabase, url, origin }) => {
  const result = await listDrops(supabase, null, parseDropFilters(url));
  if ('error' in result) return failed('Drops');
  return { body: { data: result.drops.map(d => publicDrop(d, origin)), next_cursor: result.nextCursor } };
});
export const OPTIONS = publicOptions;
