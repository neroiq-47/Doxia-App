import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to save a Drop.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'bookmark_drop' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You are saving Drops too quickly. Try again shortly.', 429);
  const { data: drop } = await supabase.from('drops').select('id').eq('id', id).in('visibility', ['public','unlisted']).maybeSingle();
  if (!drop) return jsonError('Drop not found.', 404);
  const { error } = await supabase.from('saved_drops').upsert({ drop_id: id, user_id: user.id }, { onConflict: 'drop_id,user_id', ignoreDuplicates: true });
  if (error) return jsonError('Could not save Drop.', 400);
  return jsonOk({ saved: true });
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { error } = await supabase.from('saved_drops').delete().eq('drop_id', id).eq('user_id', user.id);
  if (error) return jsonError('Could not unsave Drop.', 400);
  return jsonOk({ saved: false });
}
