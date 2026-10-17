import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
// Public: most-used topics among public Drops from the last 7 days.
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_trending_topics', { p_days: 7, p_limit: 5 });
  if (error) return jsonError('Could not load trending topics.', 500);
  return jsonOk({ topics: data ?? [] });
}
