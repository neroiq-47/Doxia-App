# Doxia MVP — integrated starter

**Product principle:** Your identity. Your signal. Your impact.

This project extends the initial UI prototype with an initial server-backed implementation for Supabase authentication/data, wallet ownership verification, Signal aggregates, Impact progress, Stripe Checkout, payment webhook entitlement handling, account deletion, and static audit checks.

## What is implemented

- Responsive Doxia dark/lime interface with Home, Drops, Signal, Impact, profile editing, and Pro modal.
- Email magic-link authentication using Supabase Auth and cookie-based SSR helpers.
- Supabase middleware session refresh/claim validation.
- Profile creation trigger and profile edit API.
- Persisted public/unlisted Drops, edit/delete APIs, reactions, saved Drops/bookmarks, search UI, share links, and reports API.
- Persisted Signal votes with a SQL aggregate function that returns totals and only the current user's own vote (not individual votes).
- Persisted Impact mission completion; points are app progress only, not a token or financial reward.
- Wallet-link challenge with random nonce, expiry, one-time consumption, domain/address binding, server-side signature verification, private wallet-link storage, and testnet intent (Robinhood Chain testnet ID `46630`).
- Stripe Checkout for a configured active **one-time GBP £11.99** price; lifetime Pro entitlement is granted only from a signed, server-verified webhook after paid status. Pro enables 1,000-character Drops (standard limit: 500) and a profile badge. Fully refunded payments revoke Pro, including protection for refund/completion event ordering.
- Account deletion API and database cascades.
- Atomic per-user rate-limit SQL function for selected mutation endpoints.
- Basic HTTP security headers and `npm run audit` static completeness check.

## What is not production-certified

- Dependencies could not be installed in the current build environment because npm registry access failed with `EAI_AGAIN`. I ran a TypeScript syntax transpile check on 29 `.ts`/`.tsx` files and the static audit script; this is **not** a full typecheck or Next.js build.
- Supabase schema, auth, wallet, Stripe, and webhooks have not been exercised against live/sandbox credentials here.
- The existing preview has local demo data when signed out. Authenticated account data uses APIs, but some visual widgets remain explicitly illustrative (e.g. trend score, demo sentiment baseline, comments/replies UI and trending-topic counts). Replies/notifications are not implemented.
- Wallet linking verifies that a user controls an EVM address by signing a short-lived message. It does not prove token balances, identity, or privacy guarantees; the `claimed_chain_id` is the chain ID stated in the signed message, not proof that a transaction occurred or that the wallet was actually connected to that chain.
- Stripe uses the configured price ID and checks it equals an active one-time GBP £11.99 price. Configure the webhook endpoint at `/api/billing/webhook` and test success, duplicate delivery, failed payment, and refund flows in Stripe test mode.
- The privacy policy, terms, moderation operations, support contact, production monitoring, scheduled cleanup, full automated test suite, and independent security review still need to be completed before public launch.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- A Supabase project
- Stripe account for payment sandbox testing
- EVM wallet for wallet-link testing

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the values below.
2. In a fresh Supabase development project, run `supabase/schema.sql` in the SQL editor.
3. Configure Supabase Auth email templates and add your local/staging callback URL, such as `http://localhost:3000/auth/callback`.
4. Use the Doxia Pro Stripe product `prod_VSR2pW8JiTcI54` and create an active one-time GBP £11.99 price. Set `STRIPE_PRO_PRODUCT_ID=prod_VSR2pW8JiTcI54` and put the matching Price ID in `STRIPE_PRO_PRICE_ID`. The checkout route and webhook validate both IDs, GBP currency, and the 1199-pence amount.
5. Configure Stripe's webhook destination as `https://YOUR_HOST/api/billing/webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable/anon client key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key; never expose it in a browser bundle or commit it.
- `APP_URL`: canonical origin of this app, e.g. `http://localhost:3000` locally and `https://app.example.com` in production.
- `STRIPE_SECRET_KEY`: server-only Stripe secret key (use `sk_test_...` during development).
- `STRIPE_WEBHOOK_SECRET`: server-only signing secret for this app's Stripe webhook endpoint.
- `STRIPE_PRO_PRODUCT_ID`: Stripe Product ID for Doxia Pro (provided: `prod_VSR2pW8JiTcI54`).
- `STRIPE_PRO_PRICE_ID`: Stripe Price ID for the active one-time GBP £11.99 price attached to that product.

## Commands

```bash
npm run dev       # local development
npm run typecheck # full TypeScript typecheck (after npm install)
npm run lint      # lint (after npm install)
npm run audit     # static completeness/security-marker check; no dependencies required
npm run build     # production build (after npm install)
```

## API outline

- `GET/POST /api/drops`
- `PATCH/DELETE /api/drops/:id`
- `POST/DELETE /api/drops/:id/reactions`
- `GET/PATCH /api/profile`
- `GET /api/signal`
- `PUT /api/signal/:slug/vote`
- `GET /api/missions`
- `POST /api/missions/:slug/complete`
- `POST /api/reports`
- `POST /api/wallet/nonce`
- `POST /api/wallet/verify`
- `GET/DELETE /api/wallet`
- `POST /api/billing/checkout`
- `GET /api/billing/entitlement`
- `POST /api/billing/webhook`
- `DELETE /api/account` with JSON body `{"confirm":"DELETE"}`
- `GET /api/health`

Authenticated mutation endpoints derive the user ID from the validated Supabase session; clients cannot choose another user's ID. The wallet table and Pro entitlements have no client write policies. The service role is used only in server-side wallet and payment routes.

## Security notes and next steps

1. Rotate any secret that has ever been committed or shared. Do not add `.env.local` to version control.
2. Test RLS as anonymous, user A, user B, and service role. Ensure user A cannot read private wallet links or entitlements for user B.
3. Add automated integration tests for auth/session refresh, ownership checks, RLS, webhook signature rejection, duplicate webhook delivery, and refund handling.
4. Add a persistent abuse-prevention layer and scheduled deletion of expired wallet challenges/rate-limit buckets. The included rate limits cover only selected user mutation routes.
5. Add support/moderation workflow, report triage, account export/deletion confirmation UX, privacy policy, terms, refund policy, and support contact.
6. Use Robinhood Chain testnet for integration tests before any mainnet functionality. Never request seed phrases or private keys; never put personal information or private messages on-chain.
7. Do not claim Doxia is Zcash-shielded or that wallet linking provides anonymous identity by itself. Privacy properties depend on the actual data and transaction design.
8. Test in Stripe test mode, verify the correct one-time price in the dashboard, and review tax/consumer requirements before accepting live payments.


## Official integration references

- Supabase SSR/auth: https://supabase.com/docs/guides/auth/server-side
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- viem message verification: https://viem.sh/docs/actions/public/verifyMessage
- Stripe Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
- Robinhood Chain network setup: https://docs.robinhood.com/chain/connecting/
