import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to view personalized Signal.', 401);
  const { data: topics, error } = await supabase.from('signal_topics').select('slug,question,created_at').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return jsonError('Could not load Signal topics.', 500);
  const summaries = [];
  for (const topic of topics ?? []) {
    const { data, error: summaryError } = await supabase.rpc('get_signal_summary', { p_slug: topic.slug });
    if (summaryError) return jsonError('Signal summary is not configured. Apply the latest Supabase schema.', 503);
    if (data?.[0]) summaries.push(data[0]);
  }
  return jsonOk({ topics: summaries });
}
