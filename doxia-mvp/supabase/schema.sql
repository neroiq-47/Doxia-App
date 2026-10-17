-- Doxia MVP schema. Apply to a fresh Supabase project and review before production.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null check (char_length(handle) between 2 and 24),
  display_name text not null default 'Doxia member' check (char_length(display_name) between 1 and 32),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automatically create a profile when Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  candidate := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'handle', split_part(coalesce(new.email, 'member'), '@', 1)), '[^a-z0-9_.]', '', 'g'));
  candidate := left(candidate, 20);
  if length(candidate) < 2 then candidate := 'member'; end if;
  if exists (select 1 from public.profiles where handle = candidate) then
    candidate := 'u_' || replace(left(new.id::text, 16), '-', '');
  end if;
  insert into public.profiles(id, handle, display_name)
  values (new.id, candidate, left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), candidate), 32))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_doxia on auth.users;
create trigger on_auth_user_created_doxia after insert on auth.users for each row execute procedure public.handle_new_user();
-- Trigger-only function: no API role should call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  topic text not null default 'Community' check (char_length(topic) <= 40),
  visibility text not null default 'public' check (visibility in ('public','unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.drops drop constraint if exists drops_body_check;
alter table public.drops drop constraint if exists drops_body_length_check;
alter table public.drops add constraint drops_body_length_check check (char_length(body) between 1 and 1000);
create index if not exists drops_created_at_idx on public.drops (created_at desc);
create index if not exists drops_author_id_idx on public.drops (author_id);

create table if not exists public.drop_reactions (
  drop_id uuid not null references public.drops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like')),
  created_at timestamptz not null default now(),
  primary key (drop_id, user_id, reaction)
);

create table if not exists public.saved_drops (
  drop_id uuid not null references public.drops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drop_id, user_id)
);

create table if not exists public.drop_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  drop_id uuid not null references public.drops(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','impersonation','illegal','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, drop_id)
);

create table if not exists public.signal_topics (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  question text not null, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.signal_votes (
  topic_id uuid not null references public.signal_topics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice text not null check (choice in ('bullish','bearish','neutral')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

create table if not exists public.impact_missions (
  id uuid primary key default gen_random_uuid(), slug text unique not null, title text not null,
  description text not null, points integer not null default 0 check (points between 0 and 1000),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.mission_completions (
  mission_id uuid not null references public.impact_missions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'completed' check (status in ('completed','reversed')),
  completed_at timestamptz not null default now(), primary key (mission_id, user_id)
);

-- Wallet address is intentionally separate from public profile data.
create table if not exists public.wallet_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text unique not null check (address ~ '^0x[0-9a-f]{40}$'),
  claimed_chain_id bigint not null,
  verified_at timestamptz not null default now()
);
-- The earlier UI prototype stored wallet_address on the public profile. Remove that column if upgrading from it;
-- wallet links now live in the private wallet_links table and must be re-verified by the owner.
alter table public.profiles drop column if exists wallet_address;

create table if not exists public.wallet_link_challenges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'), nonce_hash text unique not null,
  message_hash text not null, expires_at timestamptz not null, consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wallet_challenges_expiry_idx on public.wallet_link_challenges (expires_at);

create table if not exists public.stripe_refunded_payments (
  payment_intent_id text primary key,
  refunded_at timestamptz not null default now()
);
alter table public.stripe_refunded_payments enable row level security;
-- Only the server-side Stripe webhook writes refund records.

create table if not exists public.pro_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null, provider_customer_id text, provider_transaction_id text unique,
  status text not null default 'active' check (status in ('active','refunded','revoked')),
  granted_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.drops enable row level security;
alter table public.drop_reactions enable row level security;
alter table public.drop_reports enable row level security;
alter table public.saved_drops enable row level security;
alter table public.signal_topics enable row level security;
alter table public.signal_votes enable row level security;
alter table public.impact_missions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.wallet_links enable row level security;
alter table public.wallet_link_challenges enable row level security;
alter table public.pro_entitlements enable row level security;

-- Make policy creation repeatable when applying schema updates to an existing development project.
drop policy if exists "profiles are readable" on public.profiles;
drop policy if exists "profile owner updates" on public.profiles;
drop policy if exists "profile owner inserts" on public.profiles;
drop policy if exists "public drops readable" on public.drops;
drop policy if exists "public and unlisted drops readable" on public.drops;
drop policy if exists "authors create drops" on public.drops;
drop policy if exists "authors update drops" on public.drops;
drop policy if exists "authors delete drops" on public.drops;
drop policy if exists "reactions readable" on public.drop_reactions;
drop policy if exists "users add own reactions" on public.drop_reactions;
drop policy if exists "users remove own reactions" on public.drop_reactions;
drop policy if exists "reporter creates report" on public.drop_reports;
drop policy if exists "users read own saved drops" on public.saved_drops;
drop policy if exists "users save own drops" on public.saved_drops;
drop policy if exists "users unsave own drops" on public.saved_drops;
drop policy if exists "reporter can create report" on public.drop_reports;
drop policy if exists "reporter reads own reports" on public.drop_reports;
drop policy if exists "reporter can read own reports" on public.drop_reports;
drop policy if exists "active signal topics readable" on public.signal_topics;
drop policy if exists "users read own votes" on public.signal_votes;
drop policy if exists "users read votes aggregate only via server" on public.signal_votes;
drop policy if exists "users create own vote" on public.signal_votes;
drop policy if exists "users update own vote" on public.signal_votes;
drop policy if exists "active missions readable" on public.impact_missions;
drop policy if exists "users read own completions" on public.mission_completions;
drop policy if exists "users complete own missions" on public.mission_completions;
drop policy if exists "users reverse own completions" on public.mission_completions;
drop policy if exists "users read own wallet link" on public.wallet_links;
drop policy if exists "users read own entitlement" on public.pro_entitlements;
drop policy if exists "users read own pro entitlement" on public.pro_entitlements;

-- Public profile fields are safe for display; wallet data is in a separate private table.
create policy "profiles are readable" on public.profiles for select using (true);
create policy "profile owner updates" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "public and unlisted drops readable" on public.drops for select using (visibility in ('public', 'unlisted') or author_id = auth.uid());
create policy "authors create drops" on public.drops for insert to authenticated with check (author_id = auth.uid());
create policy "authors update drops" on public.drops for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete drops" on public.drops for delete to authenticated using (author_id = auth.uid());
create policy "reactions readable" on public.drop_reactions for select using (true);
create policy "users add own reactions" on public.drop_reactions for insert to authenticated with check (user_id = auth.uid());
create policy "users remove own reactions" on public.drop_reactions for delete to authenticated using (user_id = auth.uid());
create policy "users read own saved drops" on public.saved_drops for select to authenticated using (user_id = auth.uid());
create policy "users save own drops" on public.saved_drops for insert to authenticated with check (user_id = auth.uid());
create policy "users unsave own drops" on public.saved_drops for delete to authenticated using (user_id = auth.uid());
create policy "reporter creates report" on public.drop_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporter reads own reports" on public.drop_reports for select to authenticated using (reporter_id = auth.uid());
create policy "active signal topics readable" on public.signal_topics for select using (is_active = true);
create policy "users read own votes" on public.signal_votes for select to authenticated using (user_id = auth.uid());
create policy "users create own vote" on public.signal_votes for insert to authenticated with check (user_id = auth.uid());
create policy "users update own vote" on public.signal_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "active missions readable" on public.impact_missions for select using (is_active = true);
create policy "users read own completions" on public.mission_completions for select to authenticated using (user_id = auth.uid());
create policy "users complete own missions" on public.mission_completions for insert to authenticated with check (user_id = auth.uid());
create policy "users reverse own completions" on public.mission_completions for delete to authenticated using (user_id = auth.uid());
create policy "users read own wallet link" on public.wallet_links for select to authenticated using (user_id = auth.uid());
-- Wallet link/challenge writes are server-only via the service role after signature verification.
create policy "users read own entitlement" on public.pro_entitlements for select to authenticated using (user_id = auth.uid());
-- Intentionally no client write policies on wallet_links, wallet_link_challenges, or pro_entitlements.

-- Safe aggregate endpoint: returns only counts and the caller's own vote, never individual votes.
create or replace function public.get_signal_summary(p_slug text)
returns table(topic_id uuid, slug text, question text, bullish bigint, bearish bigint, neutral bigint, my_vote text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.slug, t.question,
    count(v.user_id) filter (where v.choice = 'bullish'),
    count(v.user_id) filter (where v.choice = 'bearish'),
    count(v.user_id) filter (where v.choice = 'neutral'),
    (select mine.choice from public.signal_votes mine where mine.topic_id = t.id and mine.user_id = auth.uid())
  from public.signal_topics t left join public.signal_votes v on v.topic_id = t.id
  where t.slug = p_slug and t.is_active = true group by t.id, t.slug, t.question;
$$;
revoke all on function public.get_signal_summary(text) from public, anon;
grant execute on function public.get_signal_summary(text) to authenticated;

-- Atomic per-user rate limits for mutation endpoints. Rows are bucketed by time window.
create table if not exists public.user_action_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, action, window_start)
);
alter table public.user_action_limits enable row level security;
drop function if exists public.consume_rate_limit(text, integer, integer);
create or replace function public.consume_rate_limit(p_action text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid; bucket timestamptz; n integer; max_requests integer; window_seconds integer;
begin
  uid := auth.uid();
  if uid is null then return false; end if;
  case p_action
    when 'create_drop' then max_requests := 5; window_seconds := 60;
    when 'report_drop' then max_requests := 5; window_seconds := 3600;
    when 'signal_vote' then max_requests := 20; window_seconds := 60;
    when 'wallet_challenge' then max_requests := 5; window_seconds := 600;
    when 'wallet_verify' then max_requests := 10; window_seconds := 600;
    when 'drop_reaction' then max_requests := 60; window_seconds := 60;
    when 'profile_update' then max_requests := 10; window_seconds := 60;
    when 'bookmark_drop' then max_requests := 100; window_seconds := 60;
    else return false;
  end case;
  bucket := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  insert into public.user_action_limits(user_id, action, window_start, request_count)
  values (uid, p_action, bucket, 1)
  on conflict (user_id, action, window_start) do update set request_count = public.user_action_limits.request_count + 1
  returning request_count into n;
  return n <= max_requests;
end;
$$;
revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

insert into public.signal_topics (slug, question) values ('privacy-web-direction', 'Where is the privacy web heading?') on conflict (slug) do nothing;
insert into public.impact_missions (slug, title, description, points) values
('open-source-builder', 'Support a public-good builder', 'Discover an open-source project and share what makes it useful.', 25),
('privacy-practice', 'Help someone take control', 'Share one practical privacy setting or safety resource with your circle.', 25),
('welcome-a-voice', 'Welcome a new voice', 'Make space for a new community member and amplify their first Drop.', 25)
on conflict (slug) do nothing;

-- Performance: evaluate auth.uid() once per statement in RLS policies (Supabase advisor 0003).
alter policy "profile owner updates" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "public and unlisted drops readable" on public.drops using (visibility in ('public', 'unlisted') or author_id = (select auth.uid()));
alter policy "authors create drops" on public.drops with check (author_id = (select auth.uid()));
alter policy "authors update drops" on public.drops using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
alter policy "authors delete drops" on public.drops using (author_id = (select auth.uid()));
alter policy "users add own reactions" on public.drop_reactions with check (user_id = (select auth.uid()));
alter policy "users remove own reactions" on public.drop_reactions using (user_id = (select auth.uid()));
alter policy "users read own saved drops" on public.saved_drops using (user_id = (select auth.uid()));
alter policy "users save own drops" on public.saved_drops with check (user_id = (select auth.uid()));
alter policy "users unsave own drops" on public.saved_drops using (user_id = (select auth.uid()));
alter policy "reporter creates report" on public.drop_reports with check (reporter_id = (select auth.uid()));
alter policy "reporter reads own reports" on public.drop_reports using (reporter_id = (select auth.uid()));
alter policy "users read own votes" on public.signal_votes using (user_id = (select auth.uid()));
alter policy "users create own vote" on public.signal_votes with check (user_id = (select auth.uid()));
alter policy "users update own vote" on public.signal_votes using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "users read own completions" on public.mission_completions using (user_id = (select auth.uid()));
alter policy "users complete own missions" on public.mission_completions with check (user_id = (select auth.uid()));
alter policy "users reverse own completions" on public.mission_completions using (user_id = (select auth.uid()));
alter policy "users read own wallet link" on public.wallet_links using (user_id = (select auth.uid()));
alter policy "users read own entitlement" on public.pro_entitlements using (user_id = (select auth.uid()));

-- Cover foreign keys used by per-user lookups and cascading deletes.
create index if not exists drop_reactions_user_id_idx on public.drop_reactions (user_id);
create index if not exists drop_reports_drop_id_idx on public.drop_reports (drop_id);
create index if not exists mission_completions_user_id_idx on public.mission_completions (user_id);
create index if not exists saved_drops_user_id_idx on public.saved_drops (user_id);
create index if not exists signal_votes_user_id_idx on public.signal_votes (user_id);
create index if not exists wallet_link_challenges_user_id_idx on public.wallet_link_challenges (user_id);
create index if not exists drops_visibility_created_at_idx on public.drops (visibility, created_at desc);

-- Signal totals are aggregate-only (my_vote is null for anonymous callers), so visitors can see real community numbers.
grant execute on function public.get_signal_summary(text) to anon;

-- Daily totals of votes cast up to each day. Aggregates only; never exposes individual votes.
create or replace function public.get_signal_history(p_slug text, p_days integer default 7)
returns table(day date, bullish bigint, bearish bigint, neutral bigint)
language sql stable security definer set search_path = '' as $$
  with topic as (select t.id from public.signal_topics t where t.slug = p_slug and t.is_active = true),
  days as (
    select generate_series((now() at time zone 'utc')::date - (least(greatest(p_days, 1), 90) - 1), (now() at time zone 'utc')::date, interval '1 day')::date as day
  )
  select d.day,
    count(v.user_id) filter (where v.choice = 'bullish'),
    count(v.user_id) filter (where v.choice = 'bearish'),
    count(v.user_id) filter (where v.choice = 'neutral')
  from days d
  left join public.signal_votes v
    on v.topic_id = (select id from topic) and (v.created_at at time zone 'utc')::date <= d.day
  group by d.day order by d.day;
$$;
revoke all on function public.get_signal_history(text, integer) from public;
grant execute on function public.get_signal_history(text, integer) to anon, authenticated;

-- Most-used topics among public Drops in a recent window. Runs as the caller, so RLS still applies.
create or replace function public.get_trending_topics(p_days integer default 7, p_limit integer default 5)
returns table(topic text, drops bigint)
language sql stable security invoker set search_path = '' as $$
  select d.topic, count(*) as drops
  from public.drops d
  where d.visibility = 'public' and d.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by d.topic order by count(*) desc, d.topic limit least(greatest(p_limit, 1), 20);
$$;
revoke all on function public.get_trending_topics(integer, integer) from public;
grant execute on function public.get_trending_topics(integer, integer) to anon, authenticated;
