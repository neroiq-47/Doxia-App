import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
import { dogeWalletEnabled, isDogeAddress, sha256Hex, verifyDogeMessage } from '@/lib/doge';

export async function POST(request: Request) {
  if (!dogeWalletEnabled()) return jsonError('Dogecoin wallet verification is not available yet.', 503);
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in before linking a Dogecoin address.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'doge_verify' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Too many verification attempts. Try again later.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const address = safeString(body.address, 40);
  const nonce = safeString(body.nonce, 100);
  const message = safeString(body.message, 2000);
  const signature = safeString(body.signature, 100);
  if (!address || !isDogeAddress(address) || !nonce || !message || !signature) return jsonError('Proof is incomplete or malformed.');
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  const { data: challenge } = await admin.from('doge_wallet_challenges').select('id,message_hash')
    .eq('user_id', user.id).eq('nonce_hash', sha256Hex(nonce)).eq('address', address).is('consumed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!challenge) return jsonError('Challenge expired or already used. Request a new one.', 409);
  if (sha256Hex(message) !== challenge.message_hash) return jsonError('Signed message does not match the challenge.', 400);
  if (!verifyDogeMessage(address, message, signature)) return jsonError('Signature could not be verified for this address.', 401);
  // Consume once (conditional update) so a captured proof cannot be replayed.
  const { data: consumed } = await admin.from('doge_wallet_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id).is('consumed_at', null).select('id').maybeSingle();
  if (!consumed) return jsonError('Challenge was already used. Request a new one.', 409);
  const { error } = await admin.from('doge_wallet_links').upsert({ user_id: user.id, address, verified_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return jsonError(error.code === '23505' ? 'This address is already linked to another account.' : 'Could not save the link.', error.code === '23505' ? 409 : 400);
  return jsonOk({ linked: true, address });
}
