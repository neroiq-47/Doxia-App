import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to react.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'drop_reaction' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You are reacting too quickly. Try again shortly.', 429);
  const { data: drop } = await supabase.from('drops').select('id').eq('id', id).in('visibility', ['public','unlisted']).maybeSingle();
  if (!drop) return jsonError('Drop not found.', 404);
  const { error } = await supabase.from('drop_reactions').upsert({ drop_id: id, user_id: user.id, reaction: 'like' }, { onConflict: 'drop_id,user_id,reaction', ignoreDuplicates: true });
  if (error) return jsonError('Could not add reaction.', 400);
  return jsonOk({ reacted: true });
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { error } = await supabase.from('drop_reactions').delete().eq('drop_id', id).eq('user_id', user.id).eq('reaction', 'like');
  if (error) return jsonError('Could not remove reaction.', 400);
  return jsonOk({ reacted: false });
}
