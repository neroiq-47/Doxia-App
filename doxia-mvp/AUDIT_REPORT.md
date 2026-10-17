# Doxia MVP — code audit report

Date: 2026-10-17

## Work completed in this pass

- Added Supabase SSR/browser clients, middleware session claim validation, email magic-link login and same-origin-safe auth callback handling.
- Connected the UI to authenticated APIs for Drops, profile edits, reactions, saved Drops, Signal votes/aggregates, Impact progress, wallet linking, Pro entitlement and report submission.
- Added edit/delete controls for a user's own Drops and shareable permalink handling for public/unlisted Drops.
- Added an account deletion endpoint with explicit confirmation and a UI warning that deletion does not automatically refund purchases.
- Added server-owned per-user rate limits in SQL; clients cannot choose the limit/window to bypass enforcement.
- Split wallet addresses from public profiles, removed the legacy public `wallet_address` column when upgrading the prototype schema, and made wallet-link writes server-only.
- Added nonce expiry, nonce/message hashes, domain/address binding, signature verification, one-time nonce consumption, unique wallet ownership, and unlink support.
- Added Stripe Checkout price and product ID validation for active one-time GBP £11.99, webhook line-item verification, idempotency key, signed webhook verification, paid-status gating, Pro entitlements, refund handling, and refund-before-completion protection.
- Made Pro access meaningful: Pro users can publish/edit up to 1,000 characters (standard limit is 500) and receive a Pro badge. The API and database enforce the limit; UI limits alone are not trusted.
- Added baseline HTTP security headers, cross-origin mutation checks, API content-length guard, static audit script, and manual acceptance checklist.

## Checks performed

- `node scripts/audit.mjs`: **passed**.
- TypeScript syntax transpilation with the globally available TypeScript compiler: **31 `.ts`/`.tsx` files checked, zero syntax errors**.
- `package.json` JSON parse: **passed**.
- SQL policy-name audit: **all 24 created policies have a preceding `DROP POLICY IF EXISTS`**, so policy setup is repeatable.
- Full `npm run typecheck`: **blocked** because dependencies are not installed; the npm registry failed with `EAI_AGAIN` during `npm install`.
- Full Next.js production build, ESLint run, Supabase integration tests, wallet signing tests, and Stripe sandbox tests: **not run** for the same dependency/service-credential limitation.

## Known remaining launch blockers

1. Install dependencies in an environment with npm registry access; run `npm run typecheck`, `npm run lint`, and `npm run build`, and fix any resulting type/API-version issues.
2. Apply `supabase/schema.sql` to a development Supabase project and test RLS using anonymous, User A, User B, and service-role contexts.
3. Test magic-link email delivery and callback on localhost and the real staging origin.
4. Test wallet linking with an EOA on Robinhood Chain testnet ID 46630. Contract-wallet signatures are not guaranteed to work in this first version. The chain ID is recorded as a signed claim, not RPC-verified network state.
5. Test Stripe checkout, duplicate requests, unpaid/async payments, duplicate webhook delivery, full/partial refunds, refund event ordering, and account deletion in test mode. Confirm the configured Stripe price really is the intended product.
6. Replies/comments, notifications, live trend data, a moderation dashboard, export UX, formal privacy/terms/refund pages, support operations, dependency/SAST scans, backups, monitoring and an independent security review remain unfinished.
7. No Zcash shielded transaction or privacy guarantee is implemented. Doxia should not claim to be Zcash-shielded, and must never ask users for seed phrases or private keys.

## Security caveat

This is a careful static engineering pass, **not a production security certification**. Service credentials, RLS behavior, payment provider events, chain configuration and deployment headers must be verified in the configured environment before accepting real users or payments.
