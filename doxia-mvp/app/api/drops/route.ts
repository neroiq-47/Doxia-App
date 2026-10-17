import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
import { DROP_SELECT, listDrops, parseDropFilters } from '@/lib/data';

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  const result = await listDrops(supabase, user?.id ?? null, parseDropFilters(new URL(request.url)));
  if ('error' in result) return jsonError(result.error ?? 'Could not load Drops.', 500);
  return jsonOk({ drops: result.drops, nextCursor: result.nextCursor });
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
  const { data: duplicate } = await supabase.from('drops').select('id').eq('author_id', user.id).eq('body', text).gt('created_at', new Date(Date.now() - 86_400_000).toISOString()).limit(1).maybeSingle();
  if (duplicate) return jsonError('You already posted this in the last 24 hours. Repeated posts are treated as spam.', 409);
  let project_id: string | null = null;
  if (typeof body.project === 'string' && body.project) {
    const { data: project } = await supabase.from('projects').select('id').eq('slug', body.project).eq('is_active', true).maybeSingle();
    if (!project) return jsonError('Unknown project.');
    project_id = project.id;
  }
  const { data, error } = await supabase.from('drops').insert({ author_id: user.id, body: text, topic, visibility, project_id }).select(DROP_SELECT).single();
  if (error) return jsonError('Could not publish Drop.', 400);
  return jsonOk({ drop: data }, 201);
}
