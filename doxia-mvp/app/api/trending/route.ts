import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
import { getTrendingTopics } from '@/lib/data';
// Public: most-used topics among public Drops from the last 7 days.
export async function GET() {
  const topics = await getTrendingTopics(await createClient());
  if (!topics) return jsonError('Could not load trending topics.', 500);
  return jsonOk({ topics });
}
