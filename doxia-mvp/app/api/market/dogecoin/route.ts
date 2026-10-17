import { jsonError, jsonOk } from '@/lib/http';
// External market data, kept separate from community Signal. Cached for 60s; attribution and freshness are always returned.
const SOURCE_URL = 'https://www.coingecko.com/en/coins/dogecoin';
export async function GET() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&vs_currencies=usd,gbp&include_24hr_change=true&include_last_updated_at=true', { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(String(response.status));
    const d = (await response.json())?.dogecoin;
    if (typeof d?.usd !== 'number' || typeof d?.last_updated_at !== 'number') throw new Error('unexpected shape');
    return jsonOk({ price: { usd: d.usd, gbp: d.gbp ?? null, change_24h_pct: d.usd_24h_change ?? null }, as_of: new Date(d.last_updated_at * 1000).toISOString(), source: 'CoinGecko', source_url: SOURCE_URL });
  } catch {
    return jsonError('Market data is temporarily unavailable.', 503);
  }
}
