import { createHash } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, jsonOk, isRecord, safeString } from '@/lib/http';
import { newNonce, nonceHash, walletMessage, WALLET_CHAIN_ID } from '@/lib/wallet';

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in before linking a wallet.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'wallet_challenge' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Too many wallet-link attempts. Try again in a few minutes.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const address = safeString(body.address, 42);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return jsonError('Enter a valid EVM wallet address.');
  const appUrl = process.env.APP_URL;
  if (!appUrl) return jsonError('APP_URL is not configured.', 503);
  const domain = new URL(appUrl).host;
  const nonce = newNonce();
  const issuedAt = new Date().toISOString();
  const message = walletMessage({ domain, origin: new URL(appUrl).origin, address: address.toLowerCase(), nonce, issuedAt });
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  await admin.from('wallet_link_challenges').delete().lt('expires_at', new Date().toISOString());
  const { error } = await admin.from('wallet_link_challenges').insert({ user_id: user.id, address: address.toLowerCase(), nonce_hash: nonceHash(nonce), message_hash: createHash('sha256').update(message).digest('hex'), expires_at: expiresAt });
  if (error) return jsonError('Could not create wallet challenge. Apply the latest Supabase schema.', 500);
  return jsonOk({ nonce, message, expiresAt, chainId: WALLET_CHAIN_ID });
}
