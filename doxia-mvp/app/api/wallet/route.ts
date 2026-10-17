import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/http';
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('wallet_links').select('address,chain_id,verified_at').eq('user_id', user.id).maybeSingle();
  if (error) return jsonError('Could not load wallet link.', 500);
  return jsonOk({ wallet: data });
}
export async function DELETE() {
  const { user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  const { error } = await admin.from('wallet_links').delete().eq('user_id', user.id);
  if (error) return jsonError('Could not unlink wallet.', 500);
  return jsonOk({ unlinked: true });
}
