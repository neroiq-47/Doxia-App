import { publicGet, publicOptions, notFound } from '@/lib/publicApi';
import { getPublicProfile, publicDrop } from '@/lib/data';
export const GET = publicGet<{ handle: string }>(async ({ supabase, origin }, { handle }) => {
  const result = await getPublicProfile(supabase, null, handle);
  if (!result) return notFound('Profile');
  return { body: { data: { ...result, drops: result.drops.map(d => publicDrop(d, origin)) } } };
});
export const OPTIONS = publicOptions;
