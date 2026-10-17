import { requireUser } from '@/lib/auth';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
import { listReplies } from '@/lib/data';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase } = await requireUser();
  const replies = await listReplies(supabase, id);
  if (!replies) return jsonError('Could not load replies.', 500);
  return jsonOk({ replies });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in to reply.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'create_reply' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('You are replying too quickly. Please wait a minute.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const text = safeString(body.body, 500);
  if (!text) return jsonError('Replies must contain 1–500 characters.');
  const parent_id = typeof body.parent_id === 'string' ? body.parent_id : null;
  const { data, error } = await supabase.from('drop_replies').insert({ drop_id: id, author_id: user.id, parent_id, body: text })
    .select('id,drop_id,author_id,parent_id,body,created_at,profiles:profiles!drop_replies_author_id_fkey(handle,display_name)').single();
  if (error) return jsonError(error.message.includes('parent') ? 'You can only reply to a top-level reply.' : 'Could not post reply.', 400);
  return jsonOk({ reply: data }, 201);
}
