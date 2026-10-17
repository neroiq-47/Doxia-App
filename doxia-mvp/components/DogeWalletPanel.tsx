"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { apiJson } from "./types";

// Native Dogecoin ownership proof: the member signs our challenge in their own wallet (e.g. Dogecoin Core "Sign Message")
// and pastes the signature. Nothing is sent on-chain and no key ever leaves their wallet.
export default function DogeWalletPanel() {
  const [linked, setLinked] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [challenge, setChallenge] = useState<{ nonce: string; message: string; expiresAt: string } | null>(null);
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { apiJson<{ wallet: { address: string } | null }>("/api/doge-wallet").then(p => setLinked(p.wallet?.address ?? null)).catch(() => setLinked(null)); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await action(); } catch (e) { setStatus(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  const start = () => run(async () => setChallenge(await apiJson("/api/doge-wallet/challenge", { method: "POST", body: JSON.stringify({ address: address.trim() }) })));
  const verify = () => run(async () => {
    if (!challenge) return;
    const result = await apiJson<{ address: string }>("/api/doge-wallet/verify", { method: "POST", body: JSON.stringify({ address: address.trim(), nonce: challenge.nonce, message: challenge.message, signature: signature.trim() }) });
    setLinked(result.address); setChallenge(null); setSignature(""); setStatus("Dogecoin address linked.");
  });
  const unlink = () => run(async () => { await apiJson("/api/doge-wallet", { method: "DELETE" }); setLinked(null); setStatus("Dogecoin address unlinked."); });

  return (
    <div className="doge-panel">
      <span className="eyebrow">DOGECOIN ADDRESS · OPTIONAL</span>
      {linked ? <p className="small-copy">Linked: {linked.slice(0, 6)}…{linked.slice(-4)} (private). <button className="text-btn inline" disabled={busy} onClick={() => void unlink()}>Unlink</button></p>
        : !challenge ? <div className="reply-row"><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Your DOGE address (starts with D)" aria-label="Dogecoin address" maxLength={40}/><button className="text-btn" disabled={busy || !address.trim()} onClick={() => void start()}>Get message</button></div>
        : <>
          <p className="small-copy">In your Dogecoin wallet, use <strong>Sign Message</strong> with this address and the exact text below, then paste the signature. Expires {new Date(challenge.expiresAt).toLocaleTimeString()}.</p>
          <pre className="docs-code">{challenge.message}</pre>
          <button className="text-btn" onClick={() => void navigator.clipboard.writeText(challenge.message)}><Copy size={12}/> Copy message</button>
          <div className="reply-row"><input value={signature} onChange={e => setSignature(e.target.value)} placeholder="Paste signature" aria-label="Signature" maxLength={100}/><button className="text-btn" disabled={busy || !signature.trim()} onClick={() => void verify()}>Verify</button></div>
        </>}
      {status && <p className="small-copy" role="status">{status}</p>}
      <p className="fine-print">Proves you control a native Dogecoin mainnet address. Never share your seed phrase or private key; Doxia will never ask. Your address and balance stay private. Wrapped DOGE on other networks is a different token, so link it with an EVM wallet. Linking proves address control only, not identity or holdings.</p>
    </div>
  );
}
