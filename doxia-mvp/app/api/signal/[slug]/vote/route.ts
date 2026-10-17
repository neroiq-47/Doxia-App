import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk } from '@/lib/http';
export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to vote.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'signal_vote' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You are voting too quickly. Try again shortly.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body) || !['bullish','bearish','neutral'].includes(String(body.choice))) return jsonError('Choice must be bullish, bearish or neutral.');
  const { data: topic, error: topicError } = await supabase.from('signal_topics').select('id').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (topicError || !topic) return jsonError('Signal topic not found.', 404);
  const { error } = await supabase.from('signal_votes').upsert({ topic_id: topic.id, user_id: user.id, choice: body.choice, updated_at: new Date().toISOString() }, { onConflict: 'topic_id,user_id' });
  if (error) return jsonError('Could not save vote.', 400);
  return jsonOk({ saved: true, choice: body.choice });
}
