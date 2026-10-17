-- DOGE Phase 1–2. Applied to production as migration doxia_11_doge_community_and_monitoring.
insert into public.projects (slug, name, symbol, description, website) values
  ('dogecoin', 'Dogecoin', 'DOGE', 'A peer-to-peer cryptocurrency launched in 2013, known for its community and tipping culture. Native DOGE runs on its own proof-of-work blockchain.', 'https://dogecoin.com')
on conflict (slug) do nothing;

insert into public.signal_topics (slug, question, project_id)
select 'dogecoin-sentiment', 'How do you feel about Dogecoin right now?', id from public.projects where slug = 'dogecoin'
on conflict (slug) do nothing;

insert into public.impact_missions (slug, title, description, points) values
  ('doge-native-vs-wrapped', 'Learn native vs wrapped DOGE', 'Learn how native Dogecoin differs from wrapped DOGE tokens on other networks, then share one takeaway in a $DOGE Drop.', 15),
  ('doge-community-resource', 'Share a Dogecoin community resource', 'Post a $DOGE Drop pointing to a useful, non-promotional Dogecoin resource for newcomers.', 15)
on conflict (slug) do nothing;

-- Suspicious-activity monitoring. Server-only log (RLS on, no policies); records which limit was hit, not content.
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  event text not null check (char_length(event) <= 60),
  action text check (char_length(action) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists security_events_created_at_idx on public.security_events (created_at desc);
create index if not exists security_events_user_id_idx on public.security_events (user_id);
alter table public.security_events enable row level security;

-- Rate limits record the first breach in each window (one row per user/action/window, so a flood cannot flood the log).
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
    when 'doge_challenge' then max_requests := 5; window_seconds := 600;
    when 'doge_verify' then max_requests := 10; window_seconds := 600;
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
  if n = max_requests + 1 then
    insert into public.security_events(user_id, event, action) values (uid, 'rate_limit_exceeded', p_action);
  end if;
  return n <= max_requests;
end;
$$;

-- Team-only review query for suspicious Signal activity. Not exposed to API roles.
create or replace function public.signal_abuse_report(p_days integer default 7)
returns table(user_id uuid, handle text, breaches bigint, last_breach timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.user_id, p.handle, count(*), max(e.created_at)
  from public.security_events e left join public.profiles p on p.id = e.user_id
  where e.event = 'rate_limit_exceeded' and e.action = 'signal_vote' and e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by e.user_id, p.handle order by count(*) desc;
$$;
revoke execute on function public.signal_abuse_report(integer) from public, anon, authenticated;
