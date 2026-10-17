import { randomBytes, createHash } from 'node:crypto';
import { verifyMessage, getAddress, isAddress } from 'viem';

export const WALLET_CHAIN_ID = 46630; // Robinhood Chain testnet; switch deliberately after testnet verification.
export function newNonce() { return randomBytes(24).toString('base64url'); }
export function nonceHash(nonce: string) { return createHash('sha256').update(nonce).digest('hex'); }
export function walletMessage(input: { domain: string; origin: string; address: string; nonce: string; issuedAt: string }) {
  return `${input.domain} wants you to sign in with your Ethereum account:\n${getAddress(input.address)}\n\nLink this wallet to your Doxia account. This signature does not authorize a transaction or transfer funds.\n\nURI: ${input.origin}\nVersion: 1\nChain ID: ${WALLET_CHAIN_ID}\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt}`;
}
export async function verifyWalletSignature(address: string, message: string, signature: `0x${string}`) {
  if (!isAddress(address)) return false;
  try { return await verifyMessage({ address: getAddress(address), message, signature }); }
  catch { return false; }
}
