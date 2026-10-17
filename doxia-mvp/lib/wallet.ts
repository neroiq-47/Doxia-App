import { randomBytes, createHash } from 'node:crypto';
import { createPublicClient, getAddress, http, isAddress, verifyMessage } from 'viem';
import { base, mainnet, robinhood, robinhoodTestnet } from 'viem/chains';

// Chains a member can state when proving wallet control. Linking is a signature only: no transaction, no funds.
export const SUPPORTED_CHAINS = {
  [robinhoodTestnet.id]: robinhoodTestnet,
  [robinhood.id]: robinhood,
  [mainnet.id]: mainnet,
  [base.id]: base,
} as const;
export const DEFAULT_WALLET_CHAIN_ID = robinhoodTestnet.id; // Robinhood Chain testnet stays the default while on-chain features are evaluated.
export function isSupportedChain(id: unknown): id is keyof typeof SUPPORTED_CHAINS {
  return typeof id === 'number' && id in SUPPORTED_CHAINS;
}

export function newNonce() { return randomBytes(24).toString('base64url'); }
export function nonceHash(nonce: string) { return createHash('sha256').update(nonce).digest('hex'); }
export function walletMessage(input: { domain: string; origin: string; address: string; nonce: string; issuedAt: string; chainId: number }) {
  return `${input.domain} wants you to sign in with your Ethereum account:\n${getAddress(input.address)}\n\nLink this wallet to your Doxia account. This signature does not authorize a transaction or transfer funds.\n\nURI: ${input.origin}\nVersion: 1\nChain ID: ${input.chainId}\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt}`;
}

// EOAs are verified locally. If that fails, ask the stated chain, which also validates smart-contract wallets (ERC-1271 / ERC-6492).
export async function verifyWalletSignature(address: string, message: string, signature: `0x${string}`, chainId: number) {
  if (!isAddress(address) || !isSupportedChain(chainId)) return false;
  const checksummed = getAddress(address);
  try { if (await verifyMessage({ address: checksummed, message, signature })) return true; } catch { /* fall through to on-chain check */ }
  try {
    const client = createPublicClient({ chain: SUPPORTED_CHAINS[chainId], transport: http(undefined, { timeout: 8000 }) });
    return await client.verifyMessage({ address: checksummed, message, signature });
  } catch { return false; }
}
