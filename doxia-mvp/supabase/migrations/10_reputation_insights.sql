-- Phase 3: contribution-based reputation, streaks, rankings and community insights.
-- Apply after 09. Applied to production as migration doxia_10_reputation_insights.
-- Scoring (transparent, contribution over popularity; caps and self-exclusion limit gaming):
--   5 per Drop (max 3 Drops counted per UTC day)      2 per like received from another member
--   2 per reply written (max 10 counted per UTC day)   1 per reply received from another member
--   3 per Signal topic voted                           mission points for completed missions
-- p_since = null means all time. Internal helper; not callable by API roles.
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
  m as (select coalesce(sum(im.points), 0) as pts from public.mission_completions mc join public.impact_missions im on im.id = mc.mission_id, since
        where mc.user_id = p_user and mc.status = 'completed' and mc.completed_at >= since.t)
  select d.pts::bigint, l.pts::bigint, rw.pts::bigint, rr.pts::bigint, s.pts::bigint, m.pts::bigint,
         (d.pts + l.pts + rw.pts + rr.pts + s.pts + m.pts)::bigint
  from d, l, rw, rr, s, m;
$$;

-- Consecutive UTC days (ending today or yesterday) with any contribution. Internal helper.
create or replace function public.contribution_streak(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $$
  with days as (
    select distinct (ts at time zone 'utc')::date as d from (
      select created_at ts from public.drops where author_id = p_user
      union all select created_at from public.drop_replies where author_id = p_user
      union all select updated_at from public.signal_votes where user_id = p_user
      union all select completed_at from public.mission_completions where user_id = p_user and status = 'completed'
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

-- The caller's own reputation, streak and badge inputs. Always available to the owner, whatever their ranking setting.
create or replace function public.get_my_reputation()
returns table(total bigint, last_30_days bigint, drops_points bigint, likes_points bigint, replies_points bigint, replies_received_points bigint, signal_points bigint, mission_points bigint,
              streak integer, drops_count bigint, replies_count bigint, topics_voted bigint, missions_completed bigint, missions_available bigint, wallet_verified boolean, is_pro boolean)
language sql stable security definer set search_path = '' as $$
  select b.total, b30.total, b.drops_points, b.likes_points, b.replies_points, b.replies_received_points, b.signal_points, b.mission_points,
    public.contribution_streak(u.id),
    (select count(*) from public.drops where author_id = u.id),
    (select count(*) from public.drop_replies where author_id = u.id),
    (select count(distinct topic_id) from public.signal_votes where user_id = u.id),
    (select count(*) from public.mission_completions where user_id = u.id and status = 'completed'),
    (select count(*) from public.impact_missions where is_active),
    exists (select 1 from public.wallet_links where user_id = u.id),
    exists (select 1 from public.pro_entitlements where user_id = u.id and status = 'active')
  from (select auth.uid() as id) u
  cross join lateral public.contribution_breakdown(u.id, null) b
  cross join lateral public.contribution_breakdown(u.id, now() - interval '30 days') b30
  where u.id is not null;
$$;

-- Ranking of members who have not opted out, over a recent window. Exposes only public profile fields and scores.
create or replace function public.get_leaderboard(p_days integer default 30, p_limit integer default 10)
returns table(rank bigint, handle text, display_name text, score bigint, streak integer)
language sql stable security definer set search_path = '' as $$
  with scored as (
    select p.handle, p.display_name, b.total as score, public.contribution_streak(p.id) as streak
    from public.profiles p
    cross join lateral public.contribution_breakdown(p.id, now() - make_interval(days => least(greatest(p_days, 1), 365))) b
    where p.show_in_rankings and b.total > 0
  )
  select row_number() over (order by score desc, handle), handle, display_name, score, streak
  from scored order by score desc, handle limit least(greatest(p_limit, 1), 50);
$$;

-- Public profile stats. Reputation, streak and badge inputs are only shown for members who appear in rankings.
create or replace function public.get_profile_stats(p_handle text)
returns table(handle text, display_name text, bio text, joined_at timestamptz, show_in_rankings boolean, public_drops bigint, likes_received bigint, replies_written bigint,
              reputation bigint, streak integer, topics_voted bigint, missions_completed bigint, missions_available bigint, wallet_verified boolean, is_pro boolean)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.display_name, p.bio, p.created_at, p.show_in_rankings,
    (select count(*) from public.drops where author_id = p.id and visibility = 'public'),
    (select count(*) from public.drop_reactions r join public.drops d on d.id = r.drop_id where d.author_id = p.id and d.visibility = 'public' and r.user_id <> p.id),
    (select count(*) from public.drop_replies rp join public.drops d on d.id = rp.drop_id where rp.author_id = p.id and d.visibility = 'public'),
    case when p.show_in_rankings then (select total from public.contribution_breakdown(p.id, null)) end,
    case when p.show_in_rankings then public.contribution_streak(p.id) end,
    case when p.show_in_rankings then (select count(distinct topic_id) from public.signal_votes where user_id = p.id) end,
    case when p.show_in_rankings then (select count(*) from public.mission_completions where user_id = p.id and status = 'completed') end,
    (select count(*) from public.impact_missions where is_active),
    case when p.show_in_rankings then exists (select 1 from public.wallet_links where user_id = p.id) end,
    case when p.show_in_rankings then exists (select 1 from public.pro_entitlements where user_id = p.id and status = 'active') end
  from public.profiles p where p.handle = lower(p_handle);
$$;

-- Community-wide aggregates only.
create or replace function public.get_community_stats()
returns table(members bigint, active_contributors_7d bigint, drops_7d bigint, replies_7d bigint, votes_total bigint, votes_7d bigint, missions_completed_total bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.profiles),
    (select count(distinct uid) from (
      select author_id uid from public.drops where created_at > now() - interval '7 days'
      union select author_id from public.drop_replies where created_at > now() - interval '7 days'
      union select user_id from public.signal_votes where updated_at > now() - interval '7 days'
      union select user_id from public.mission_completions where completed_at > now() - interval '7 days') a),
    (select count(*) from public.drops where visibility = 'public' and created_at > now() - interval '7 days'),
    (select count(*) from public.drop_replies rp join public.drops d on d.id = rp.drop_id where d.visibility = 'public' and rp.created_at > now() - interval '7 days'),
    (select count(*) from public.signal_votes),
    (select count(*) from public.signal_votes where updated_at > now() - interval '7 days'),
    (select count(*) from public.mission_completions where status = 'completed');
$$;

revoke all on function public.get_my_reputation() from public, anon;
grant execute on function public.get_my_reputation() to authenticated;
revoke all on function public.get_leaderboard(integer, integer) from public;
revoke all on function public.get_profile_stats(text) from public;
revoke all on function public.get_community_stats() from public;
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.get_profile_stats(text) to anon, authenticated;
grant execute on function public.get_community_stats() to anon, authenticated;
