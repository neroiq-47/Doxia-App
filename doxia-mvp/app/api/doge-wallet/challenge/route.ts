import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
import { DOGE_CHALLENGE_TTL_MS, dogeChallengeMessage, dogeWalletEnabled, isDogeAddress, newDogeNonce, sha256Hex } from '@/lib/doge';

export async function POST(request: Request) {
  if (!dogeWalletEnabled()) return jsonError('Dogecoin wallet verification is not available yet.', 503);
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in before linking a Dogecoin address.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'doge_challenge' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Too many attempts. Try again in a few minutes.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  const address = isRecord(body) ? safeString(body.address, 40) : null;
  if (!address || !isDogeAddress(address)) return jsonError('Enter a native Dogecoin mainnet address starting with "D". Wrapped DOGE on other networks is linked with an EVM wallet instead.');
  const appUrl = process.env.APP_URL;
  if (!appUrl) return jsonError('APP_URL is not configured.', 503);
  const nonce = newDogeNonce();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + DOGE_CHALLENGE_TTL_MS);
  const message = dogeChallengeMessage({ domain: new URL(appUrl).host, origin: new URL(appUrl).origin, address, nonce, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() });
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  await admin.from('doge_wallet_challenges').delete().lt('expires_at', new Date().toISOString());
  const { error } = await admin.from('doge_wallet_challenges').insert({ user_id: user.id, address, nonce_hash: sha256Hex(nonce), message_hash: sha256Hex(message), expires_at: expiresAt.toISOString() });
  if (error) return jsonError('Could not create a challenge.', 500);
  return jsonOk({ nonce, message, expiresAt: expiresAt.toISOString() });
}
