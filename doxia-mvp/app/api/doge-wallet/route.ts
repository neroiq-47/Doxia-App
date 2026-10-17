import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { dogeWalletEnabled } from '@/lib/doge';
// The member's own linked Dogecoin address (private: never shown on profiles or in the public API).
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  const { data, error } = await supabase.from('doge_wallet_links').select('address,verified_at').eq('user_id', user.id).maybeSingle();
  if (error) return jsonError('Could not load Dogecoin wallet link.', 500);
  return jsonOk({ enabled: dogeWalletEnabled(), wallet: data });
}
export async function DELETE() {
  const { user } = await requireUser();
  if (!user) return jsonError('Sign in required.', 401);
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  const { error } = await admin.from('doge_wallet_links').delete().eq('user_id', user.id);
  if (error) return jsonError('Could not unlink Dogecoin address.', 500);
  return jsonOk({ unlinked: true });
}
