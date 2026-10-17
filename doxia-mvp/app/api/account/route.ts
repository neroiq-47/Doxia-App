import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRecord, jsonError, jsonOk } from '@/lib/http';

export async function DELETE(request: Request) {
  const { user } = await requireUser();
  if (!user) return jsonError('Sign in before deleting your account.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Confirm account deletion in the request body.'); }
  if (!isRecord(body) || body.confirm !== 'DELETE') return jsonError('Send {"confirm":"DELETE"} to confirm permanent account deletion.');
  let admin;
  try { admin = createAdminClient(); } catch { return jsonError('Account deletion is not configured on the server.', 503); }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return jsonError('Could not delete account. Contact support before retrying.', 500);
  return jsonOk({ deleted: true });
}
