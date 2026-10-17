# Doxia MVP acceptance checklist

Run these checks after `npm install`, applying `supabase/schema.sql` to a development Supabase project, and configuring Stripe test mode.

## Build and app shell
- [ ] `npm run typecheck` passes with installed dependencies.
- [ ] `npm run lint` passes.
- [ ] `npm run build` completes.
- [ ] `/api/health` returns `status: ok` and the expected backend configuration flag.
- [ ] Desktop and mobile layouts work at 360px, 768px, 1024px and 1440px widths.
- [ ] Keyboard-only navigation can reach all controls; dialog close controls work; focus is visible.

## Authentication and account isolation
- [ ] Email magic link signs in and callback returns to the same origin only.
- [ ] Session survives refresh and signs out cleanly.
- [ ] User A cannot read or mutate User B's profile-private data, wallet link, votes, mission completion, reports, or entitlement.
- [ ] Anonymous users can read only public/unlisted Drops and public profile display fields.
- [ ] Account deletion removes auth account and cascades app data; confirm no unintended refund is implied.

## Drops and moderation
- [ ] Create a Drop with 1 and 500 characters; reject empty and 501+ characters.
- [ ] Edit/delete own Drop; attempts to edit/delete another user's Drop return 404.
- [ ] Public feed pagination and share links work, including an unlisted Drop link.
- [ ] Bookmarks persist across sessions for signed-in users and stay local in preview mode.
- [ ] Standard users are limited to 500 characters; Pro users can publish/edit up to 1,000; server rejects bypass attempts.
- [ ] Like/unlike is idempotent across repeated requests and count refreshes correctly.
- [ ] A report can be submitted once per reporter/Drop; duplicate report is rejected.
- [ ] Rate limit returns 429 after the configured request count; user cannot increase the limit via direct RPC arguments.

## Signal and Impact
- [ ] One vote per account/topic; changing vote updates aggregate counts once.
- [ ] Aggregate endpoint returns counts and caller's own vote, not other users' individual choices.
- [ ] Mission completion persists across sessions and duplicate completion does not multiply points.
- [ ] UI never presents sample trend/signal values as financial advice or live market data.

## Wallet
- [ ] Linking requires authenticated account, an EVM wallet, and chain ID 46630 in the client.
- [ ] Message includes app domain, address, chain intent, nonce, issue time and no-transaction/no-funds language.
- [ ] Wrong address, wrong domain, altered message, invalid signature, expired nonce, replayed nonce and reused wallet all fail.
- [ ] No wallet private key or seed phrase is requested, logged, or stored.
- [ ] Wallet link is private to the owner; unlink works.

## Payments
- [ ] Checkout rejects a missing/inactive/recurring/non-GBP/not-£11.99 or wrong product ID price.
- [ ] Stripe secret and service role key never appear in browser bundles or client responses.
- [ ] Forged webhook signature returns 400; unpaid session grants no Pro.
- [ ] Paid session grants Pro exactly once; duplicate delivery is safe.
- [ ] Fully refunded payment revokes Pro; partial refund behavior is understood and tested.
- [ ] Refund event arriving before checkout completion still prevents Pro from being granted.
- [ ] Success redirect alone does not grant Pro; only verified webhook does.
- [ ] Check concurrent checkout requests, cancellation/retry, expired session, and refund event ordering in Stripe test mode.

## Release readiness
- [ ] Add privacy policy, terms, refund policy, contact/support details and moderation operations.
- [ ] Add operational logs/alerts, backup/restore test, expired challenge/rate-limit cleanup, and incident response.
- [ ] Run dependency audit, SAST, secret scan, accessibility checks, and independent security review.
- [ ] Complete private beta before public launch.
