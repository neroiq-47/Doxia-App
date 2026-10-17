import { createHash } from 'node:crypto';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRecord, jsonError, jsonOk, safeString } from '@/lib/http';
import { isSupportedChain, nonceHash, verifyWalletSignature } from '@/lib/wallet';

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError('Sign in before linking a wallet.', 401);
  const { data: allowed, error: rateError } = await supabase.rpc('consume_rate_limit', { p_action: 'wallet_verify' });
  if (rateError) return jsonError('Rate limiting is not configured. Apply the latest Supabase schema.', 503);
  if (!allowed) return jsonError('Too many wallet verification attempts. Try again later.', 429);
  let body: unknown; try { body = await request.json(); } catch { return jsonError('Invalid JSON body.'); }
  if (!isRecord(body)) return jsonError('Invalid request body.');
  const address = safeString(body.address, 42);
  const nonce = safeString(body.nonce, 100);
  const message = safeString(body.message, 2000);
  const signature = safeString(body.signature, 132);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address) || !nonce || !message || !signature || !/^0x[a-fA-F0-9]+$/.test(signature)) return jsonError('Wallet proof is incomplete or malformed.');
  const appUrl = process.env.APP_URL;
  if (!appUrl) return jsonError('APP_URL is not configured.', 503);
  const expectedDomain = new URL(appUrl).host;
  const messageLines = message.split('\n');
  const chainId = Number(/\nChain ID: (\d+)\nNonce: /.exec(message)?.[1]);
  if (!isSupportedChain(chainId)) return jsonError('Signature message names an unsupported network.');
  if (!message.startsWith(`${expectedDomain} wants you to sign in with your Ethereum account:`) || messageLines[1]?.toLowerCase() !== address.toLowerCase() || !message.includes(`Chain ID: ${chainId}\nNonce: ${nonce}\n`)) return jsonError('Signature message does not match this app, address or network.');
  let admin; try { admin = createAdminClient(); } catch { return jsonError('Server wallet-link configuration is missing.', 503); }
  const { data: challenge, error: challengeError } = await admin.from('wallet_link_challenges').select('id,nonce_hash,message_hash,expires_at,consumed_at,address').eq('user_id', user.id).eq('nonce_hash', nonceHash(nonce)).eq('address', address.toLowerCase()).is('consumed_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (challengeError || !challenge) return jsonError('Wallet challenge expired or already used. Request a new one.', 409);
  const messageHash = createHash('sha256').update(message).digest('hex');
  if (messageHash !== challenge.message_hash) return jsonError('Signed message does not match the challenge.', 400);
  const valid = await verifyWalletSignature(address, message, signature as `0x${string}`, chainId);
  if (!valid) return jsonError('Wallet signature could not be verified.', 401);
  // Consume the challenge with a conditional update to prevent replay. The DB uniqueness constraint prevents one wallet being linked to multiple accounts.
  const { data: consumed, error: consumeError } = await admin.from('wallet_link_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id).is('consumed_at', null).select('id').maybeSingle();
  if (consumeError || !consumed) return jsonError('Wallet challenge was already used. Request a new one.', 409);
  const { error: linkError } = await admin.from('wallet_links').upsert({ user_id: user.id, address: address.toLowerCase(), claimed_chain_id: chainId, verified_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (linkError) return jsonError(linkError.code === '23505' ? 'This wallet is already linked to another account.' : 'Could not save wallet link.', linkError.code === '23505' ? 409 : 400);
  return jsonOk({ linked: true, address: address.toLowerCase(), chainId });
}
