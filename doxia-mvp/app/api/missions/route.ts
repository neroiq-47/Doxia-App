import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  const { data: missions, error } = await supabase.from('impact_missions').select('id,slug,title,description,points').eq('is_active', true).order('created_at');
  if (error) return jsonError('Could not load missions.', 500);
  if (!user) return jsonOk({ missions: (missions ?? []).map(m => ({ ...m, completed: false })) });
  const { data: completions, error: completionError } = await supabase.from('mission_completions').select('mission_id,status').eq('user_id', user.id).eq('status', 'completed');
  if (completionError) return jsonError('Could not load mission progress.', 500);
  const done = new Set((completions ?? []).map(c => c.mission_id));
  return jsonOk({ missions: (missions ?? []).map(m => ({ ...m, completed: done.has(m.id) })) });
}
