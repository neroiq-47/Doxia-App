import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30) || 30, 1), 50);
  const cursor = url.searchParams.get('before');
  let query = supabase.from('drops').select('id,author_id,body,topic,visibility,created_at,profiles:profiles!drops_author_id_fkey(handle,display_name),drop_reactions(count)').eq('visibility', 'public').order('created_at', { ascending: false }).limit(limit);
  if (cursor) query = query.lt('created_at', cursor);
  const { data, error } = await query;
  if (error) return jsonError('Could not load Drops.', 500);
  let likedIds = new Set<string>();
  if (user && data?.length) {
    const { data: ownReactions } = await supabase.from('drop_reactions').select('drop_id').eq('user_id', user.id).in('drop_id', data.map(d => d.id));
    likedIds = new Set((ownReactions ?? []).map(r => r.drop_id));
  }
  const nextCursor = data && data.length === limit ? data[data.length - 1].created_at : null;
  return jsonOk({ drops: (data ?? []).map(d => ({ ...d, liked: likedIds.has(d.id) })), nextCursor });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to publish a Drop.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'create_drop' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You are posting too quickly. Please wait a minute.', 429);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const text = safeString(body.body, 1000);
  const topic = typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim().slice(0, 40) : 'Community';
  const visibility = body.visibility === 'unlisted' ? 'unlisted' : body.visibility === 'public' || body.visibility === undefined ? 'public' : null;
  if (!text) return jsonError('Drop must contain 1–1,000 characters.');
  if (text.length > 500) {
    const { data: entitlement, error: entitlementError } = await supabase.from('pro_entitlements').select('status').eq('user_id', user.id).maybeSingle();
    if (entitlementError) return jsonError('Could not verify Pro entitlement.', 500);
    if (entitlement?.status !== 'active') return jsonError('Drops over 500 characters require Doxia Pro.', 403);
  }
  if (!visibility) return jsonError('Invalid visibility.');
  const { data, error } = await supabase.from('drops').insert({ author_id: user.id, body: text, topic, visibility }).select('id,author_id,body,topic,visibility,created_at').single();
  if (error) return jsonError('Could not publish Drop.', 400);
  return jsonOk({ drop: data }, 201);
}
