import { requireUser } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/http';
// Reply authors can delete their own replies; Drop authors can remove replies on their Drop (enforced by RLS).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('drop_replies').delete().eq('id', id).select('id').maybeSingle();
  if (error) return jsonError('Could not delete reply.', 400);
  if (!data) return jsonError('Reply not found or you cannot remove it.', 404);
  return jsonOk({ deleted: true });
}
