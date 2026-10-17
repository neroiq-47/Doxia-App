import { randomBytes, createHash } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { ripemd160 } from '@noble/hashes/legacy';
import { base58 } from '@scure/base';

// Native Dogecoin mainnet only. Dogecoin's `signmessage` signs with legacy P2PKH keys, whose addresses start with "D".
// Wrapped DOGE on other networks is a different asset (an issuer's token contract) and is linked with an EVM wallet instead.
export const DOGE_P2PKH_VERSION = 0x1e;
const MESSAGE_PREFIX = 'Dogecoin Signed Message:\n';
export const DOGE_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function dogeWalletEnabled() { return process.env.DOGE_WALLET_ENABLED === 'true'; }

const utf8 = (s: string) => new TextEncoder().encode(s);
const doubleSha = (b: Uint8Array) => sha256(sha256(b));
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
function varint(n: number) {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, n >> 8);
  return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

// Hash exactly as Dogecoin Core's signmessage/verifymessage: dSHA256(varint(len(prefix)) | prefix | varint(len(msg)) | msg).
export function dogeMessageHash(message: string) {
  const prefix = utf8(MESSAGE_PREFIX), body = utf8(message);
  return doubleSha(concat(varint(prefix.length), prefix, varint(body.length), body));
}

export function decodeDogeAddress(address: string): { version: number; hash: Uint8Array } | null {
  try {
    const raw = base58.decode(address);
    if (raw.length !== 25) return null;
    const payload = raw.slice(0, 21);
    if (!sameBytes(doubleSha(payload).slice(0, 4), raw.slice(21))) return null;
    return { version: payload[0], hash: payload.slice(1) };
  } catch { return null; }
}
export function isDogeAddress(address: string) { return decodeDogeAddress(address)?.version === DOGE_P2PKH_VERSION; }

export function dogeAddressFromPublicKey(publicKey: Uint8Array) {
  const payload = concat(Uint8Array.of(DOGE_P2PKH_VERSION), ripemd160(sha256(publicKey)));
  return base58.encode(concat(payload, doubleSha(payload).slice(0, 4)));
}

// Recover the signing key from a base64 compact signature (header byte 27–34) and check it hashes to the claimed address.
export function verifyDogeMessage(address: string, message: string, signatureBase64: string) {
  if (!isDogeAddress(address) || !/^[A-Za-z0-9+/]{86}[A-Za-z0-9+/=]{2}$/.test(signatureBase64)) return false;
  const signature = Uint8Array.from(Buffer.from(signatureBase64, 'base64'));
  if (signature.length !== 65 || signature[0] < 27 || signature[0] > 34) return false;
  const compressed = signature[0] >= 31;
  const recovery = (signature[0] - 27) & 3;
  try {
    const point = secp256k1.Signature.fromCompact(signature.slice(1)).addRecoveryBit(recovery).recoverPublicKey(dogeMessageHash(message));
    return dogeAddressFromPublicKey(point.toRawBytes(compressed)) === address;
  } catch { return false; }
}

export function newDogeNonce() { return randomBytes(24).toString('base64url'); }
export function sha256Hex(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function dogeChallengeMessage(input: { domain: string; origin: string; address: string; nonce: string; issuedAt: string; expiresAt: string }) {
  return `${input.domain} wants you to prove you control this Dogecoin address:\n${input.address}\n\nLink this address to your Doxia account. This does not authorize a transaction or move funds.\n\nURI: ${input.origin}\nNetwork: Dogecoin mainnet (native DOGE)\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt}\nExpires At: ${input.expiresAt}`;
}
