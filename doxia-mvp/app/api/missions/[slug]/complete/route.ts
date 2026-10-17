import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to record mission progress.', 401);
  const { data: mission, error: missionError } = await supabase.from('impact_missions').select('id,points,kind').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (missionError || !mission) return jsonError('Mission not found.', 404);
  if (mission.kind === 'weekly') {
    // Weekly challenges can only be completed during the week they are scheduled (enforced again by RLS).
    const { data: weekStart, error: weekError } = await supabase.rpc('ensure_weekly_challenges');
    if (weekError || !weekStart) return jsonError('Could not load this week’s challenges.', 500);
    const { error } = await supabase.from('weekly_challenge_completions').upsert({ week_start: weekStart, mission_id: mission.id, user_id: user.id }, { onConflict: 'week_start,mission_id,user_id', ignoreDuplicates: true });
    if (error) return jsonError('That challenge is not part of this week’s set.', 400);
    return jsonOk({ completed: true, points: mission.points, week_start: weekStart, note: 'Points are app progress only; no token or financial reward is issued.' });
  }
  const { error } = await supabase.from('mission_completions').upsert({ mission_id: mission.id, user_id: user.id, status: 'completed' }, { onConflict: 'mission_id,user_id', ignoreDuplicates: true });
  if (error) return jsonError('Could not record mission completion.', 400);
  return jsonOk({ completed: true, points: mission.points, note: 'Points are app progress only; no token or financial reward is issued.' });
}
