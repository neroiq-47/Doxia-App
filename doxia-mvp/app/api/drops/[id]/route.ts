import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from('drops').select('id,author_id,body,topic,visibility,created_at,profiles:profiles!drops_author_id_fkey(handle,display_name),drop_reactions(count)').eq('id', id).maybeSingle();
  if (error || !data) return jsonError('Drop not found.', 404);
  let liked = false;
  if (user) {
    const { data: reaction } = await supabase.from('drop_reactions').select('drop_id').eq('drop_id', id).eq('user_id', user.id).maybeSingle();
    liked = Boolean(reaction);
  }
  return jsonOk({ drop: { ...data, liked } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const text = safeString(body.body, 1000);
  if (!text) return jsonError('Drop must contain 1–1,000 characters.');
  if (text.length > 500) {
    const { data: entitlement, error: entitlementError } = await supabase.from('pro_entitlements').select('status').eq('user_id', user.id).maybeSingle();
    if (entitlementError) return jsonError('Could not verify Pro entitlement.', 500);
    if (entitlement?.status !== 'active') return jsonError('Drops over 500 characters require Doxia Pro.', 403);
  }
  const { data, error } = await supabase.from('drops').update({ body: text, updated_at: new Date().toISOString() }).eq('id', id).eq('author_id', user.id).select('id,body,topic,visibility,updated_at').maybeSingle();
  if (error) return jsonError('Could not update Drop.', 400);
  if (!data) return jsonError('Drop not found or not owned by you.', 404);
  return jsonOk({ drop: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('drops').delete().eq('id', id).eq('author_id', user.id).select('id').maybeSingle();
  if (error) return jsonError('Could not delete Drop.', 400);
  if (!data) return jsonError('Drop not found or not owned by you.', 404);
  return jsonOk({ deleted: true });
}
