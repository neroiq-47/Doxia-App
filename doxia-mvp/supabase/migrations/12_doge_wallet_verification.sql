-- DOGE Phase 3. Applied to production as migration doxia_12_doge_wallet_verification.
-- The app keeps this disabled unless DOGE_WALLET_ENABLED=true (pending security review).
-- Only legacy P2PKH "D..." addresses can sign messages with Dogecoin's signmessage, so only those are accepted.
create table if not exists public.doge_wallet_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text unique not null check (address ~ '^D[1-9A-HJ-NP-Za-km-z]{25,34}$'),
  verified_at timestamptz not null default now()
);
create table if not exists public.doge_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address text not null check (address ~ '^D[1-9A-HJ-NP-Za-km-z]{25,34}$'),
  nonce_hash text unique not null,
  message_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists doge_wallet_challenges_user_id_idx on public.doge_wallet_challenges (user_id);
create index if not exists doge_wallet_challenges_expiry_idx on public.doge_wallet_challenges (expires_at);
alter table public.doge_wallet_links enable row level security;
alter table public.doge_wallet_challenges enable row level security;
create policy "users read own doge wallet link" on public.doge_wallet_links for select to authenticated using (user_id = (select auth.uid()));
