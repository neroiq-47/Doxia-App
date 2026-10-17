# Dogecoin integration audit — 17 Oct 2026

Deployment `74d28a8` live on Railway at 17:43 UTC. Method: database tests run as simulated members inside rolled-back transactions on production Supabase; signature verifier cross-validated against an independent reference implementation; live HTTP checks against the deployed app; Supabase security advisor; code review.

## Acceptance criteria

| Phase | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Users can discover and publish Dogecoin content | **Pass** (DB) | Project + topic visible; $DOGE Drop inserted under RLS; `search_drops('doge')` finds it; live `/api/v1/projects/dogecoin` 200 |
| 1 | Votes persist; aggregates display accurately | **Pass** | Vote neutral→bullish leaves 1 bullish, 0 neutral (replace, not add) |
| 1 | Features available without holding DOGE | **Pass** | No feature checks holdings; stated on project pages and guidelines |
| 1 | Reporting and rate limiting active | **Pass** | Report flow unchanged; limits enforced in SQL; duplicate-post guard (24 h) added |
| 2 | Aggregates reproducible from stored votes | **Pass** | `get_signal_summary` equals a direct `count(*) … from signal_votes` |
| 2 | Data freshness and source visible | **Pass** | Live market endpoint returns `source: CoinGecko`, `source_url`, `as_of`; Signal returns `generated_at` |
| 2 | Sentiment not presented as prediction/advice | **Pass** | Separate "Market price · not sentiment" card; "not financial advice" on Signal, embeds, API, guidelines |
| 2 | Vote rate limits + suspicious-activity monitoring | **Pass** | 25 calls vs limit 20 → exactly 1 `security_events` row; `signal_abuse_report` returns it; clients cannot read the log or run the report |
| 2 | Individual vote histories not exposed | **Pass** | Only totals published; `security_events` stores the limit hit, never a vote choice |
| 3 | Challenges expire and cannot be reused | **Pass** (code) | 10-min expiry, nonce/message stored as hashes, conditional single-use consume (same pattern as tested EVM flow) |
| 3 | Invalid signatures and replays rejected | **Pass** | 115/115 cross-checks vs bitcoinjs-message: valid sigs accepted; tampered message, wrong address, Bitcoin-prefixed signature, Bitcoin/P2SH/testnet addresses, bad checksum, malformed sigs rejected |
| 3 | No flow asks for seed phrases or keys | **Pass** | Paste-signature flow only; explicit warnings in UI and guidelines |
| 3 | Linking proves control only | **Pass** | Stated in UI copy and plan |
| 3 | Minimal, private data; unlink | **Pass** | Address + timestamp only; RLS owner-read; client writes blocked; unlink route; included in export; cascades on account deletion |
| 3 | Native vs wrapped distinguished | **Pass** | Mainnet P2PKH only; UI directs wrapped DOGE to EVM linking |
| 4 | Payments | **Not built** | Requires provider choice + legal/compliance review (scope gate) |
| 5 | Ecosystem | **Not built** | Gated on sustained use (scope gate) |

## Live checks (production)
- `GET /api/health` → `features.dogeWallet: false` (Phase 3 correctly off)
- `GET /api/doge-wallet` signed out → 401
- `GET /api/market/dogecoin` → price, 24 h change, `source`, `as_of`
- `GET /api/v1/projects/dogecoin` → project, Signal topic with 30-day history
- `GET /api/v1/drops?q=%%` → empty (wildcards treated literally)
- `GET /guidelines` → published

## Security advisor
No new actionable findings. New server-only tables (`security_events`, `doge_wallet_challenges`) intentionally have RLS with no policies. Callable definer functions are the previously reviewed aggregate-only functions. `signal_abuse_report` is not callable by API roles.

## Open items (ranked)
1. **Signed-in flows not exercised end-to-end in production** (posting a $DOGE Drop, voting, duplicate guard) — verified at the database layer and in the build; needs one manual pass by a signed-in member.
2. **Phase 3 enablement prerequisites:** independent security review; `SUPABASE_SERVICE_ROLE_KEY` on Railway; one real Dogecoin Core `signmessage` round-trip before setting `DOGE_WALLET_ENABLED=true`.
3. **Retention:** add scheduled deletion of `security_events` older than 90 days and of expired wallet challenges.
4. **Moderation tooling:** reports are stored but there is no review dashboard yet.
5. **Market data terms:** CoinGecko's free API requires attribution (provided); confirm plan/terms before any commercial launch.
6. **Sign-in email capacity:** built-in Supabase email is capped at 2/hour until custom SMTP is verified.
