import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { getTrendingTopics } from '@/lib/data';
export const GET = publicGet(async ({ supabase }) => {
  const topics = await getTrendingTopics(supabase);
  return topics ? { body: { data: topics, window_days: 7 } } : failed('trending topics');
});
export const OPTIONS = publicOptions;
