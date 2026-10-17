-- Phase 2: projects, project-linked Drops and Signal topics, threaded replies, ranking opt-out.
-- Apply after schema.sql. Applied to production as migration doxia_09_discovery_projects_replies.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  symbol text check (symbol is null or char_length(symbol) <= 12),
  description text not null default '' check (char_length(description) <= 280),
  website text check (website is null or website ~ '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "active projects readable" on public.projects for select using (is_active = true);

alter table public.signal_topics add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists signal_topics_project_id_idx on public.signal_topics (project_id);
alter table public.drops add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists drops_project_id_created_at_idx on public.drops (project_id, created_at desc);
create index if not exists drops_topic_created_at_idx on public.drops (topic, created_at desc);

alter table public.profiles add column if not exists show_in_rankings boolean not null default true;

create table if not exists public.drop_replies (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.drop_replies(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists drop_replies_drop_id_created_at_idx on public.drop_replies (drop_id, created_at);
create index if not exists drop_replies_author_id_idx on public.drop_replies (author_id);
create index if not exists drop_replies_parent_id_idx on public.drop_replies (parent_id);
alter table public.drop_replies enable row level security;
create policy "replies readable with their drop" on public.drop_replies for select using (
  exists (select 1 from public.drops d where d.id = drop_id and (d.visibility in ('public', 'unlisted') or d.author_id = (select auth.uid())))
);
create policy "users reply as themselves" on public.drop_replies for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.drops d where d.id = drop_id and (d.visibility in ('public', 'unlisted') or d.author_id = (select auth.uid())))
);
-- Reply authors can delete their replies; Drop authors can moderate replies on their own Drop.
create policy "reply or drop author deletes reply" on public.drop_replies for delete to authenticated using (
  author_id = (select auth.uid())
  or exists (select 1 from public.drops d where d.id = drop_id and d.author_id = (select auth.uid()))
);

-- Threads are one level deep: a reply's parent must be a top-level reply on the same Drop.
create or replace function public.check_reply_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.drop_replies r where r.id = new.parent_id and r.drop_id = new.drop_id and r.parent_id is null
  ) then
    raise exception 'Reply parent must be a top-level reply on the same Drop';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_reply_parent() from public, anon, authenticated;
create trigger drop_replies_parent_check before insert on public.drop_replies for each row execute function public.check_reply_parent();

-- Add the reply and export actions to the server-owned rate limits.
create or replace function public.consume_rate_limit(p_action text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid; bucket timestamptz; n integer; max_requests integer; window_seconds integer;
begin
  uid := auth.uid();
  if uid is null then return false; end if;
  case p_action
    when 'create_drop' then max_requests := 5; window_seconds := 60;
    when 'create_reply' then max_requests := 10; window_seconds := 60;
    when 'report_drop' then max_requests := 5; window_seconds := 3600;
    when 'signal_vote' then max_requests := 20; window_seconds := 60;
    when 'wallet_challenge' then max_requests := 5; window_seconds := 600;
    when 'wallet_verify' then max_requests := 10; window_seconds := 600;
    when 'drop_reaction' then max_requests := 60; window_seconds := 60;
    when 'profile_update' then max_requests := 10; window_seconds := 60;
    when 'bookmark_drop' then max_requests := 100; window_seconds := 60;
    when 'data_export' then max_requests := 3; window_seconds := 3600;
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

-- Trending: Hacker News-style decay. (likes + 2*replies + 1) / (age_hours + 2)^1.8, public Drops only.
create or replace function public.get_trending_drops(p_hours integer default 72, p_limit integer default 20)
returns setof public.drops
language sql stable security invoker set search_path = '' as $$
  select d.* from public.drops d
  left join (select drop_id, count(*) c from public.drop_reactions group by drop_id) l on l.drop_id = d.id
  left join (select drop_id, count(*) c from public.drop_replies group by drop_id) r on r.drop_id = d.id
  where d.visibility = 'public' and d.created_at > now() - make_interval(hours => least(greatest(p_hours, 1), 720))
  order by (coalesce(l.c, 0) + 2 * coalesce(r.c, 0) + 1)::float8
         / power(extract(epoch from now() - d.created_at) / 3600.0 + 2, 1.8) desc, d.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Search public Drops by text, topic, project or author. Input is treated as a literal (LIKE wildcards escaped).
create or replace function public.search_drops(p_query text, p_limit integer default 30)
returns setof public.drops
language sql stable security invoker set search_path = '' as $$
  with q as (select '%' || replace(replace(replace(left(trim(p_query), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat)
  select d.* from public.drops d
  left join public.profiles p on p.id = d.author_id
  left join public.projects pr on pr.id = d.project_id, q
  where d.visibility = 'public' and length(trim(p_query)) >= 2
    and (d.body ilike q.pat or d.topic ilike q.pat or p.handle ilike q.pat or p.display_name ilike q.pat or pr.name ilike q.pat or pr.symbol ilike q.pat)
  order by d.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.search_profiles(p_query text, p_limit integer default 10)
returns table(handle text, display_name text, bio text)
language sql stable security invoker set search_path = '' as $$
  with q as (select '%' || replace(replace(replace(left(trim(p_query), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat)
  select p.handle, p.display_name, p.bio from public.profiles p, q
  where length(trim(p_query)) >= 2 and (p.handle ilike q.pat or p.display_name ilike q.pat)
  order by p.handle limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.get_trending_drops(integer, integer) from public;
revoke all on function public.search_drops(text, integer) from public;
revoke all on function public.search_profiles(text, integer) from public;
grant execute on function public.get_trending_drops(integer, integer) to anon, authenticated;
grant execute on function public.search_drops(text, integer) to anon, authenticated;
grant execute on function public.search_profiles(text, integer) to anon, authenticated;

-- Real projects for project pages and project-specific Signal.
insert into public.projects (slug, name, symbol, description, website) values
  ('bitcoin', 'Bitcoin', 'BTC', 'The first decentralized cryptocurrency: a peer-to-peer electronic cash system launched in 2009.', 'https://bitcoin.org'),
  ('ethereum', 'Ethereum', 'ETH', 'A programmable blockchain for smart contracts and decentralized applications.', 'https://ethereum.org'),
  ('zcash', 'Zcash', 'ZEC', 'A privacy-focused cryptocurrency that uses zero-knowledge proofs to support shielded transactions.', 'https://z.cash'),
  ('robinhood-chain', 'Robinhood Chain', null, 'Robinhood''s Ethereum-compatible blockchain network. Doxia wallet linking supports its testnet.', 'https://docs.robinhood.com/chain/')
on conflict (slug) do nothing;

insert into public.signal_topics (slug, question, project_id)
select p.slug || '-sentiment', 'How do you feel about ' || p.name || ' right now?', p.id from public.projects p
on conflict (slug) do nothing;
