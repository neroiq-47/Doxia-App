import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
import { listSignalTopics } from '@/lib/data';
// Public: aggregate totals, 30-day history and a confidence interval per topic. my_vote is only set for the signed-in caller.
export async function GET() {
  const topics = await listSignalTopics(await createClient(), 30);
  if (!topics) return jsonError('Signal is not configured. Apply the latest Supabase schema.', 503);
  return jsonOk({ topics, generated_at: new Date().toISOString() });
}
