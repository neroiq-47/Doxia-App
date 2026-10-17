-- "Mission Complete" badge counts permanent (core) missions only; weekly challenges rotate and are tracked separately.
-- Applied to production as migration doxia_14_badge_counts_core_missions.
create or replace function public.get_my_reputation()
returns table(total bigint, last_30_days bigint, drops_points bigint, likes_points bigint, replies_points bigint, replies_received_points bigint, signal_points bigint, mission_points bigint,
              streak integer, drops_count bigint, replies_count bigint, topics_voted bigint, missions_completed bigint, missions_available bigint, wallet_verified boolean, is_pro boolean)
language sql stable security definer set search_path = '' as $$
  select b.total, b30.total, b.drops_points, b.likes_points, b.replies_points, b.replies_received_points, b.signal_points, b.mission_points,
    public.contribution_streak(u.id),
    (select count(*) from public.drops where author_id = u.id),
    (select count(*) from public.drop_replies where author_id = u.id),
    (select count(distinct topic_id) from public.signal_votes where user_id = u.id),
    (select count(*) from public.mission_completions mc join public.impact_missions im on im.id = mc.mission_id where mc.user_id = u.id and mc.status = 'completed' and im.kind = 'core'),
    (select count(*) from public.impact_missions where is_active and kind = 'core'),
    exists (select 1 from public.wallet_links where user_id = u.id),
    exists (select 1 from public.pro_entitlements where user_id = u.id and status = 'active')
  from (select auth.uid() as id) u
  cross join lateral public.contribution_breakdown(u.id, null) b
  cross join lateral public.contribution_breakdown(u.id, now() - interval '30 days') b30
  where u.id is not null;
$$;

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
    case when p.show_in_rankings then (select count(*) from public.mission_completions mc join public.impact_missions im on im.id = mc.mission_id where mc.user_id = p.id and mc.status = 'completed' and im.kind = 'core') end,
    (select count(*) from public.impact_missions where is_active and kind = 'core'),
    case when p.show_in_rankings then exists (select 1 from public.wallet_links where user_id = p.id) end,
    case when p.show_in_rankings then exists (select 1 from public.pro_entitlements where user_id = p.id and status = 'active') end
  from public.profiles p where p.handle = lower(p_handle);
$$;
