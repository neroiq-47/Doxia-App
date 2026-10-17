import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/http';
import { getCommunityStats } from '@/lib/data';
export async function GET() {
  const stats = await getCommunityStats(await createClient());
  if (!stats) return jsonError('Could not load community insights.', 500);
  return jsonOk({ stats });
}
