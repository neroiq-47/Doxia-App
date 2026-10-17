-- Profiles: enforce rules in the database so direct API calls cannot bypass the app.
-- Applied to production as migration doxia_16_profile_hardening.
-- 1) Members may only change their handle, display name, bio and ranking setting; nobody inserts or deletes directly.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (handle, display_name, bio, show_in_rankings) on public.profiles to authenticated;

-- 2) Server-maintained timestamps.
create or replace function public.profiles_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke execute on function public.profiles_set_updated_at() from public, anon, authenticated;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.profiles_set_updated_at();

-- 3) Handle format and reserved names; no control, zero-width or bidi-override characters in names or bios.
create or replace function public.is_reserved_handle(p_handle text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(p_handle) = any (array['admin','administrator','doxia','doxiateam','doxia_team','support','help','helpdesk','moderator','mod','mods','official','team','staff','root','system','security','api','null','undefined','me','settings','login','signup','developers','guidelines','privacy','terms','abuse','report','everyone']);
$$;
alter table public.profiles add constraint profiles_handle_format check (handle ~ '^[a-z0-9_][a-z0-9_.]{1,23}$' and not public.is_reserved_handle(handle));
alter table public.profiles add constraint profiles_display_name_clean check (btrim(display_name) <> '' and display_name !~ '[\u0000-\u001F\u007F​-‏‪-‮⁠-⁩﻿]');
alter table public.profiles add constraint profiles_bio_clean check (bio !~ '[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁠-⁩﻿]');

-- 4) New members get a random pseudonymous handle; nothing is derived from their email or client-supplied metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  loop
    candidate := 'member_' || substr(md5(new.id::text || clock_timestamp()::text || random()::text), 1, 10);
    exit when not exists (select 1 from public.profiles where handle = candidate);
  end loop;
  insert into public.profiles(id, handle, display_name) values (new.id, candidate, 'Doxia member')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
