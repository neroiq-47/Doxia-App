-- Five weekly challenges. Tops up a partially filled week (keeping existing picks and completions), avoiding last week's picks.
-- Applied to production as migration doxia_15_five_weekly_challenges.
create or replace function public.ensure_weekly_challenges()
returns date language plpgsql volatile security definer set search_path = '' as $$
declare wk date := public.current_week_start(); per_week constant integer := 5; have integer;
begin
  select count(*) into have from public.weekly_challenge_schedule where week_start = wk;
  if have >= per_week then return wk; end if;
  perform pg_advisory_xact_lock(hashtext('doxia_weekly_challenges_' || wk::text));
  select count(*) into have from public.weekly_challenge_schedule where week_start = wk;
  if have >= per_week then return wk; end if;
  insert into public.weekly_challenge_schedule (week_start, mission_id)
  select wk, m.id from public.impact_missions m
  where m.kind = 'weekly' and m.is_active
    and not exists (select 1 from public.weekly_challenge_schedule c where c.week_start = wk and c.mission_id = m.id)
  order by exists (select 1 from public.weekly_challenge_schedule p where p.week_start = wk - 7 and p.mission_id = m.id), random()
  limit per_week - have;
  return wk;
end;
$$;
revoke all on function public.ensure_weekly_challenges() from public;
grant execute on function public.ensure_weekly_challenges() to anon, authenticated;

select public.ensure_weekly_challenges();
