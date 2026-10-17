import { publicGet, publicOptions, notFound } from '@/lib/publicApi';
import { getDrop, publicDrop } from '@/lib/data';
export const GET = publicGet<{ id: string }>(async ({ supabase, origin }, { id }) => {
  const drop = await getDrop(supabase, null, id);
  return drop ? { body: { data: publicDrop(drop, origin) } } : notFound('Drop');
});
export const OPTIONS = publicOptions;
