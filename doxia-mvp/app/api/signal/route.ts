import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
// Public: totals and daily history are aggregates. my_vote is only filled in for the signed-in caller.
export async function GET() {
  const supabase = await createClient();
  const { data: topics, error } = await supabase.from('signal_topics').select('slug,question,created_at').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return jsonError('Could not load Signal topics.', 500);
  const summaries = [];
  for (const topic of topics ?? []) {
    const [{ data, error: summaryError }, { data: history, error: historyError }] = await Promise.all([
      supabase.rpc('get_signal_summary', { p_slug: topic.slug }),
      supabase.rpc('get_signal_history', { p_slug: topic.slug, p_days: 7 }),
    ]);
    if (summaryError || historyError) return jsonError('Signal summary is not configured. Apply the latest Supabase schema.', 503);
    if (data?.[0]) summaries.push({ ...data[0], history: history ?? [] });
  }
  return jsonOk({ topics: summaries });
}
