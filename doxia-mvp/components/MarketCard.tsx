"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LineChart } from "lucide-react";
import { apiJson } from "./types";

type Market = { price: { usd: number; gbp: number | null; change_24h_pct: number | null }; as_of: string; source: string; source_url: string };

// External market data, deliberately styled and labelled apart from Doxia's community Signal.
export default function MarketCard() {
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiJson<Market>("/api/market/dogecoin").then(setMarket).catch(e => setError(e.message)); }, []);
  const change = market?.price.change_24h_pct;
  return (
    <div className="signal-prompt market-card">
      <span className="eyebrow"><LineChart size={13}/> MARKET DATA · EXTERNAL SOURCE</span>
      {error && <p className="feed-status">{error}</p>}
      {!market && !error && <p className="feed-status">Loading market data…</p>}
      {market && <>
        <div className="market-row"><strong>${market.price.usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong>{market.price.gbp !== null && <span>£{market.price.gbp.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>}{typeof change === "number" && <span className={change >= 0 ? "up" : "down"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% 24h</span>}</div>
        <p className="fine-print">Source: <a href={market.source_url} target="_blank" rel="noopener noreferrer">{market.source} <ExternalLink size={10}/></a> · price as of {new Date(market.as_of).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. This is market data, not Doxia community sentiment. Crypto prices change rapidly and you can lose money buying or holding cryptoassets.</p>
      </>}
    </div>
  );
}
