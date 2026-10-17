import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to record mission progress.', 401);
  const { data: mission, error: missionError } = await supabase.from('impact_missions').select('id,points').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (missionError || !mission) return jsonError('Mission not found.', 404);
  const { error } = await supabase.from('mission_completions').upsert({ mission_id: mission.id, user_id: user.id, status: 'completed' }, { onConflict: 'mission_id,user_id', ignoreDuplicates: true });
  if (error) return jsonError('Could not record mission completion.', 400);
  return jsonOk({ completed: true, points: mission.points, note: 'Points are app progress only; no token or financial reward is issued.' });
}
