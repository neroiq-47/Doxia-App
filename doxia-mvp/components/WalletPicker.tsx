"use client";

import { useEffect, useState } from "react";
import { Wallet, X } from "lucide-react";
import { base, mainnet, robinhood, robinhoodTestnet, type Chain } from "viem/chains";
import { apiJson } from "./types";

type Eip1193 = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> };
type WalletOption = { id: string; name: string; icon: string | null; provider: Eip1193 };
const CHAINS: Chain[] = [robinhoodTestnet, robinhood, mainnet, base];
const hex = (id: number) => `0x${id.toString(16)}`;

// EIP-6963: every installed wallet announces itself, so members choose instead of whichever extension grabbed window.ethereum.
function useWallets() {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<{ info: { uuid: string; name: string; icon: string }; provider: Eip1193 }>).detail;
      if (!detail?.info?.uuid) return;
      setWallets(ws => ws.some(w => w.id === detail.info.uuid) ? ws : [...ws, { id: detail.info.uuid, name: detail.info.name, icon: detail.info.icon, provider: detail.provider }]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = window.setTimeout(() => setWallets(ws => ws.length || !window.ethereum ? ws : [{ id: "injected", name: "Browser wallet", icon: null, provider: window.ethereum }]), 400);
    return () => { window.removeEventListener("eip6963:announceProvider", onAnnounce); window.clearTimeout(fallback); };
  }, []);
  return wallets;
}

async function ensureChain(provider: Eip1193, chain: Chain) {
  const current = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (current === hex(chain.id)) return;
  try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex(chain.id) }] }); }
  catch (error) {
    if ((error as { code?: number }).code !== 4902) throw new Error(`Switch your wallet to ${chain.name} to continue. No transaction is required.`);
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex(chain.id), chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls.default.http, blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined }] });
  }
}

export default function WalletPicker({ onClose, onLinked }: { onClose: () => void; onLinked: (address: string) => void }) {
  const wallets = useWallets();
  const [chainId, setChainId] = useState<number>(robinhoodTestnet.id);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function link(wallet: WalletOption) {
    const chain = CHAINS.find(c => c.id === chainId)!;
    setBusy(true); setStatus("Waiting for your wallet…");
    try {
      const accounts = await wallet.provider.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("No wallet account was selected.");
      await ensureChain(wallet.provider, chain);
      const challenge = await apiJson<{ nonce: string; message: string }>("/api/wallet/nonce", { method: "POST", body: JSON.stringify({ address, chainId }) });
      setStatus("Sign the message in your wallet. It is free and moves no funds.");
      const signature = await wallet.provider.request({ method: "personal_sign", params: [challenge.message, address] }) as string;
      setStatus("Verifying…");
      const result = await apiJson<{ address: string }>("/api/wallet/verify", { method: "POST", body: JSON.stringify({ address, nonce: challenge.nonce, message: challenge.message, signature }) });
      onLinked(result.address);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Wallet linking failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
        <div className="modal-head"><div><span className="eyebrow">VERIFY OWNERSHIP</span><h2 id="wallet-title">Link a wallet.</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
        <label className="field-label">Network<select value={chainId} onChange={e => setChainId(Number(e.target.value))}>{CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}{c.testnet ? " (testnet)" : ""}</option>)}</select></label>
        <div className="wallet-list">
          {wallets.length === 0 && <p className="feed-status">No browser wallet found. Install one such as MetaMask, Rabby or Coinbase Wallet, then reopen this window.</p>}
          {wallets.map(w => <button key={w.id} className="wallet-option" disabled={busy} onClick={() => void link(w)}>
            {/* Wallet icons are data URIs announced by the extension, so next/image adds nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {w.icon ? <img src={w.icon} alt="" width={24} height={24}/> : <Wallet size={20}/>}
            <span>{w.name}</span>
          </button>)}
        </div>
        {status && <p className="login-message wallet-status" role="status">{status}</p>}
        <div className="privacy-callout"><Wallet size={17}/><span>You sign a one-time message to prove you control the address. Doxia never asks for your seed phrase or private key, sends no transaction, and keeps your address private. It isn&apos;t shown on your profile. Smart-contract wallets are supported.</span></div>
      </section>
    </div>
  );
}
