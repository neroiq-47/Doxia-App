-- Weekly community challenges: a pool of challenges picked at random every Sunday 00:00 UTC (5 per week since migration 15).
-- Applied to production as migration doxia_13_weekly_challenges.
alter table public.impact_missions add column if not exists kind text not null default 'core' check (kind in ('core', 'weekly'));

-- Weeks run Sunday 00:00 UTC to the next Sunday.
create or replace function public.current_week_start()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date - extract(dow from (now() at time zone 'utc'))::int;
$$;

create table if not exists public.weekly_challenge_schedule (
  week_start date not null check (extract(dow from week_start) = 0),
  mission_id uuid not null references public.impact_missions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (week_start, mission_id)
);
create table if not exists public.weekly_challenge_completions (
  week_start date not null,
  mission_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (week_start, mission_id, user_id),
  foreign key (week_start, mission_id) references public.weekly_challenge_schedule(week_start, mission_id) on delete cascade
);
create index if not exists weekly_challenge_completions_user_id_idx on public.weekly_challenge_completions (user_id);
alter table public.weekly_challenge_schedule enable row level security;
alter table public.weekly_challenge_completions enable row level security;
create policy "weekly schedule readable" on public.weekly_challenge_schedule for select using (true);
create policy "users read own weekly completions" on public.weekly_challenge_completions for select to authenticated using (user_id = (select auth.uid()));
-- Completions only for this week's scheduled challenges; past weeks are closed.
create policy "users complete this week's challenges" on public.weekly_challenge_completions for insert to authenticated with check (
  user_id = (select auth.uid()) and week_start = public.current_week_start()
  and exists (select 1 from public.weekly_challenge_schedule s where s.week_start = weekly_challenge_completions.week_start and s.mission_id = weekly_challenge_completions.mission_id)
);

-- Pick this week's challenges once. Random, avoiding last week's picks when the pool allows; safe under concurrent calls.
create or replace function public.ensure_weekly_challenges()
returns date language plpgsql volatile security definer set search_path = '' as $$
declare wk date := public.current_week_start();
begin
  if exists (select 1 from public.weekly_challenge_schedule where week_start = wk) then return wk; end if;
  perform pg_advisory_xact_lock(hashtext('doxia_weekly_challenges_' || wk::text));
  if exists (select 1 from public.weekly_challenge_schedule where week_start = wk) then return wk; end if;
  insert into public.weekly_challenge_schedule (week_start, mission_id)
  select wk, m.id from public.impact_missions m
  where m.kind = 'weekly' and m.is_active
  order by exists (select 1 from public.weekly_challenge_schedule p where p.week_start = wk - 7 and p.mission_id = m.id), random()
  limit 3;
  return wk;
end;
$$;
revoke all on function public.ensure_weekly_challenges() from public;
grant execute on function public.ensure_weekly_challenges() to anon, authenticated;

-- Reputation, streaks and community stats include weekly challenges.
create or replace function public.contribution_breakdown(p_user uuid, p_since timestamptz default null)
returns table(drops_points bigint, likes_points bigint, replies_points bigint, replies_received_points bigint, signal_points bigint, mission_points bigint, total bigint)
language sql stable security definer set search_path = '' as $$
  with since as (select coalesce(p_since, '-infinity'::timestamptz) as t),
  d as (select coalesce(sum(least(c, 3)), 0) * 5 as pts from (
    select count(*) c from public.drops, since where author_id = p_user and created_at >= since.t group by (created_at at time zone 'utc')::date) x),
  l as (select count(*) * 2 as pts from public.drop_reactions r join public.drops dr on dr.id = r.drop_id, since
        where dr.author_id = p_user and r.user_id <> p_user and r.created_at >= since.t),
  rw as (select coalesce(sum(least(c, 10)), 0) * 2 as pts from (
    select count(*) c from public.drop_replies, since where author_id = p_user and created_at >= since.t group by (created_at at time zone 'utc')::date) x),
  rr as (select count(*) as pts from public.drop_replies rp join public.drops dr on dr.id = rp.drop_id, since
         where dr.author_id = p_user and rp.author_id <> p_user and rp.created_at >= since.t),
  s as (select count(distinct v.topic_id) * 3 as pts from public.signal_votes v, since where v.user_id = p_user and v.created_at >= since.t),
  m as (select
          coalesce((select sum(im.points) from public.mission_completions mc join public.impact_missions im on im.id = mc.mission_id, since
                    where mc.user_id = p_user and mc.status = 'completed' and mc.completed_at >= since.t), 0)
        + coalesce((select sum(im.points) from public.weekly_challenge_completions wc join public.impact_missions im on im.id = wc.mission_id, since
                    where wc.user_id = p_user and wc.completed_at >= since.t), 0) as pts)
  select d.pts::bigint, l.pts::bigint, rw.pts::bigint, rr.pts::bigint, s.pts::bigint, m.pts::bigint,
         (d.pts + l.pts + rw.pts + rr.pts + s.pts + m.pts)::bigint
  from d, l, rw, rr, s, m;
$$;

create or replace function public.contribution_streak(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  with days as (
    select distinct (ts at time zone 'utc')::date as d from (
      select created_at ts from public.drops where author_id = p_user
      union all select created_at from public.drop_replies where author_id = p_user
      union all select updated_at from public.signal_votes where user_id = p_user
      union all select completed_at from public.mission_completions where user_id = p_user and status = 'completed'
      union all select completed_at from public.weekly_challenge_completions where user_id = p_user
    ) a
  ),
  anchor as (
    select case
      when exists (select 1 from days where d = (now() at time zone 'utc')::date) then (now() at time zone 'utc')::date
      when exists (select 1 from days where d = (now() at time zone 'utc')::date - 1) then (now() at time zone 'utc')::date - 1
    end as a
  ),
  ranked as (select d, row_number() over (order by d desc) as rn from days)
  select coalesce((select count(*)::int from ranked, anchor where anchor.a is not null and ranked.d + ranked.rn::int = anchor.a + 1), 0);
$$;
revoke execute on function public.contribution_breakdown(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.contribution_streak(uuid) from public, anon, authenticated;

create or replace function public.get_community_stats()
returns table(members bigint, active_contributors_7d bigint, drops_7d bigint, replies_7d bigint, votes_total bigint, votes_7d bigint, missions_completed_total bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.profiles),
    (select count(distinct uid) from (
      select author_id uid from public.drops where created_at > now() - interval '7 days'
      union select author_id from public.drop_replies where created_at > now() - interval '7 days'
      union select user_id from public.signal_votes where updated_at > now() - interval '7 days'
      union select user_id from public.mission_completions where completed_at > now() - interval '7 days'
      union select user_id from public.weekly_challenge_completions where completed_at > now() - interval '7 days') a),
    (select count(*) from public.drops where visibility = 'public' and created_at > now() - interval '7 days'),
    (select count(*) from public.drop_replies rp join public.drops d on d.id = rp.drop_id where d.visibility = 'public' and rp.created_at > now() - interval '7 days'),
    (select count(*) from public.signal_votes),
    (select count(*) from public.signal_votes where updated_at > now() - interval '7 days'),
    (select count(*) from public.mission_completions where status = 'completed') + (select count(*) from public.weekly_challenge_completions);
$$;

-- The challenge pool. Self-reported, constructive, never financial; in-app points only.
insert into public.impact_missions (slug, title, description, points, kind) values
  ('wk-thoughtful-replies', 'Reply thoughtfully three times', 'Add a considered reply to three different Drops this week. Ask a question or build on the idea.', 15, 'weekly'),
  ('wk-two-signals', 'Read the room twice', 'Vote on two Signal topics you have not voted on before.', 10, 'weekly'),
  ('wk-privacy-setting', 'Share a privacy setting you use', 'Post a Drop explaining one privacy setting you rely on and why it helps.', 15, 'weekly'),
  ('wk-welcome-newcomer', 'Welcome a newcomer', 'Reply warmly to someone’s first Drop and point them to something useful.', 10, 'weekly'),
  ('wk-open-source-pick', 'Spotlight an open-source tool', 'Share an open-source project you actually use and what it does well.', 15, 'weekly'),
  ('wk-explain-a-term', 'Explain a term for newcomers', 'Pick one crypto or privacy term and explain it in plain words in a Drop.', 15, 'weekly'),
  ('wk-cite-a-source', 'Share with a source', 'Post a Drop about news or research and link the primary source.', 15, 'weekly'),
  ('wk-scam-red-flag', 'Name a scam red flag', 'Share one warning sign of a crypto scam so others can spot it. Never share keys or seed phrases.', 15, 'weekly'),
  ('wk-new-project', 'Explore a new project page', 'Visit a project page you have not opened before and post one honest observation about it.', 10, 'weekly'),
  ('wk-summarise-thread', 'Summarise a discussion', 'Write a short, fair summary of a conversation happening on Doxia this week.', 15, 'weekly'),
  ('wk-enable-2fa', 'Lock down an account', 'Turn on two-factor authentication for an account you use (no need to say which).', 10, 'weekly'),
  ('wk-wallet-safety', 'Share a wallet safety habit', 'Post one habit that keeps a wallet safe, like verifying addresses before sending.', 15, 'weekly')
on conflict (slug) do nothing;

-- Run every Sunday at 00:00 UTC; the app also calls ensure_weekly_challenges() so a missed run self-heals.
create extension if not exists pg_cron;
select cron.schedule('doxia-weekly-challenges', '0 0 * * 0', $$select public.ensure_weekly_challenges()$$);

-- Pick this week's set now.
select public.ensure_weekly_challenges();
