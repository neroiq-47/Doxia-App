# Dogecoin ($DOGE) integration plan

Source: *Doxia DOGE Integration Scope*. Principle: make Dogecoin useful in Doxia **without requiring anyone to buy or hold DOGE**. Phases ship only when their acceptance criteria are tested (see `docs/DOGE_AUDIT.md`).

| Phase | Status | Release state |
|---|---|---|
| 1 — Community layer | Built, tested | **Live** |
| 2 — Signal intelligence | Built, tested | **Live** |
| 3 — Wallet verification | Built, tested (115/115 cross-checks) | **Deployed disabled** (`DOGE_WALLET_ENABLED` unset) pending security review and the service-role key |
| 4 — Payments & tipping | Evaluated, not built | Blocked on provider choice + legal/compliance review |
| 5 — Ecosystem integrations | Not started | Gated on sustained use of phases 1–4 |

## Phase 1 — Community layer (live)
- Dogecoin project page (`/?project=dogecoin`, copyable link) with a $DOGE topic feed; Drops can be tagged to the project and found by search ("doge", "$DOGE").
- Signal topic `dogecoin-sentiment` with positive / neutral / cautious votes (one per account; changing replaces).
- Missions: *Learn native vs wrapped DOGE*, *Share a Dogecoin community resource* (in-app points only).
- Spam controls: server rate limits on posting/replying/voting, duplicate-post rejection (same text, same author, 24 h), reporting, published `/guidelines`.
- No feature requires holding DOGE.

## Phase 2 — Signal intelligence (live)
- 30-day sentiment timeline, total participation, Wilson 95% confidence per topic.
- Market price shown **only** on the Dogecoin page, in a separately labelled "Market price · not sentiment" card with source (CoinGecko), link and "as of" time; 60 s server cache.
- Signal shows when totals were computed. Aggregates are computed live from stored votes (reproducible; see audit).
- Suspicious-activity monitoring: the first rate-limit breach per user/action/window is written to `security_events` (no content, no vote choice). Team review: `select * from signal_abuse_report(7);` in the Supabase SQL editor.
- Individual votes are never exposed; only totals.

## Phase 3 — Dogecoin wallet verification (deployed disabled)
- **Supported:** native Dogecoin **mainnet** legacy P2PKH addresses (`D…`), the address type Dogecoin Core's *Sign Message* / `signmessage` supports. Not supported: P2SH (`9…`/`A…`), testnet, wrapped DOGE (use an EVM wallet link for wrapped tokens).
- **Flow:** request challenge (10-minute expiry, server stores only hashes) → sign in own wallet → paste signature → server recovers the key from the signature (`"Dogecoin Signed Message:\n"` prefix, secp256k1), checks it hashes to the address, consumes the challenge once.
- **Data kept:** address + verified time only; private (owner-readable via RLS, never in profiles or the public API); unlink deletes it; included in data export; deleted with the account.
- **To enable:** complete a security review, set `SUPABASE_SERVICE_ROLE_KEY` and `DOGE_WALLET_ENABLED=true` on Railway, then run the acceptance tests against a real Dogecoin Core signature.

## Phase 4 — Payments & tipping (evaluation only)
Not built: the scope requires legal/compliance review and a validated provider before any production payments.
Recommended approach when approved:
1. **Non-custodial only.** Tips go wallet-to-wallet; Doxia never holds funds. Doxia shows recipient, amount, network (Dogecoin mainnet) and the network fee estimate before the member's own wallet signs.
2. **Verification:** reconcile by txid against two independent sources (own Dogecoin node or a reputable indexer plus a second provider), require N confirmations, store txid with a unique constraint (idempotency, replay protection), link to a block explorer.
3. **Disclosures:** irreversible transactions, fees, no refunds by Doxia, price volatility, not financial advice.
4. **Before launch:** provider due diligence (maintenance, security, support), abuse monitoring (self-tipping rings, wash activity), support runbook, legal review of tipping/money-transmission obligations in target jurisdictions.

## Phase 5 — Ecosystem (gated)
Directory, sponsored missions, contribution evidence, analytics and on-chain credentials only after phases 1–4 show sustained use and pass operational, security and compliance review. **No Doxia token** and no promised financial rewards.
