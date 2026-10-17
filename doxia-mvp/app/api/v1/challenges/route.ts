import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { getWeeklyChallenges } from '@/lib/challenges';
export const GET = publicGet(async ({ supabase }) => {
  const weekly = await getWeeklyChallenges(supabase, null);
  if (!weekly) return failed('weekly challenges');
  return { body: { data: { ...weekly, challenges: weekly.challenges.map(({ id: _id, completed: _c, ...c }) => c) }, rotation: 'Three challenges picked at random every Sunday 00:00 UTC, avoiding the previous week’s picks.' } };
});
export const OPTIONS = publicOptions;
