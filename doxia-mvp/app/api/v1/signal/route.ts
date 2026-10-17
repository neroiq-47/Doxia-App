import { publicGet, publicOptions, failed } from '@/lib/publicApi';
import { listSignalTopics } from '@/lib/data';
export const GET = publicGet(async ({ supabase, url }) => {
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30) || 30, 1), 90);
  const topics = await listSignalTopics(supabase, days);
  if (!topics) return failed('Signal');
  return { body: { data: topics.map(({ my_vote: _ignored, ...t }) => t), note: 'Community opinion, not financial advice.' } };
});
export const OPTIONS = publicOptions;
