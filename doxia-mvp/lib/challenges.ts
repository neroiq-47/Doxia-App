import type { SupabaseClient } from '@supabase/supabase-js';

// This week's randomly picked community challenges (rotated every Sunday 00:00 UTC by pg_cron; generated on first read if a run was missed).
export async function getWeeklyChallenges(supabase: SupabaseClient, userId: string | null) {
  const { data: weekStart, error } = await supabase.rpc('ensure_weekly_challenges');
  if (error || !weekStart) return null;
  const { data: schedule, error: scheduleError } = await supabase.from('weekly_challenge_schedule')
    .select('mission_id,impact_missions(id,slug,title,description,points)').eq('week_start', weekStart);
  if (scheduleError) return null;
  let done = new Set<string>();
  if (userId) {
    const { data: completions } = await supabase.from('weekly_challenge_completions').select('mission_id').eq('week_start', weekStart).eq('user_id', userId);
    done = new Set((completions ?? []).map(c => c.mission_id as string));
  }
  const start = new Date(`${weekStart}T00:00:00Z`);
  const challenges = (schedule ?? [])
    .map(s => s.impact_missions as unknown as { id: string; slug: string; title: string; description: string; points: number } | null)
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(m => ({ ...m, completed: done.has(m.id) }));
  return { week_start: weekStart as string, ends_at: new Date(start.getTime() + 7 * 86_400_000).toISOString(), challenges };
}
