-- ─────────────────────────────────────────
-- 010: supervisor availabilities, admin shift assignment, new morning shift times
-- Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

-- 1. One row per supervisor per week: which shift blocks they could take
create table if not exists public.availabilities (
  id uuid default gen_random_uuid() primary key,
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  supervisor_name text not null default '',
  week_start date not null check (extract(isodow from week_start) = 1),
  shift_block_ids uuid[] not null default '{}',
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (supervisor_id, week_start)
);
alter table public.availabilities enable row level security;

-- Name and timestamp always come from the server, never from the client
create or replace function public.availabilities_set_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.supervisor_name := coalesce((select name from public.profiles where id = new.supervisor_id), '');
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.availabilities_set_defaults() from public, anon, authenticated;
drop trigger if exists availabilities_set_defaults on public.availabilities;
create trigger availabilities_set_defaults
  before insert or update on public.availabilities
  for each row execute function public.availabilities_set_defaults();

-- Staff only: members and guests never see who is available when
revoke all on public.availabilities from anon;
revoke truncate, trigger, references on public.availabilities from authenticated;
grant select, insert, update, delete on public.availabilities to authenticated;

drop policy if exists "Availabilities: staff read" on public.availabilities;
create policy "Availabilities: staff read"
  on public.availabilities for select to authenticated
  using ((select public.app_role()) in ('supervisor', 'admin'));

drop policy if exists "Availabilities: own insert" on public.availabilities;
create policy "Availabilities: own insert"
  on public.availabilities for insert to authenticated
  with check ((select public.app_role()) in ('supervisor', 'admin') and supervisor_id = (select auth.uid()));

drop policy if exists "Availabilities: own update" on public.availabilities;
create policy "Availabilities: own update"
  on public.availabilities for update to authenticated
  using ((select public.app_role()) in ('supervisor', 'admin') and supervisor_id = (select auth.uid()))
  with check ((select public.app_role()) in ('supervisor', 'admin') and supervisor_id = (select auth.uid()));

drop policy if exists "Availabilities: admin manage" on public.availabilities;
create policy "Availabilities: admin manage"
  on public.availabilities for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Realtime: the admin's assignment page updates live when someone submits
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'availabilities') then
    alter publication supabase_realtime add table public.availabilities;
  end if;
end $$;

-- 2. Admin assigns a shift to a supervisor (claim_shift only ever assigns the caller)
create or replace function public.admin_assign_shift(p_shift_id uuid, p_supervisor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only admins can assign shifts' using errcode = '42501';
  end if;
  select name into v_name from public.profiles
   where id = p_supervisor_id and role in ('supervisor', 'admin');
  if not found then
    raise exception 'That user is not a supervisor' using errcode = 'P0001';
  end if;
  update public.shift_blocks set supervisor_id = p_supervisor_id, supervisor_name = v_name
   where id = p_shift_id;
  if not found then
    raise exception 'Shift not found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.admin_assign_shift(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_shift(uuid, uuid) to authenticated;

-- 3. Morning shifts: weekdays 06:00–08:00, weekends 09:00–11:00.
--    The earliest block of each day that starts before noon is the morning shift.
with morning as (
  select distinct on (day_of_week) id, day_of_week
    from public.shift_blocks
   where start_time < '12:00'
   order by day_of_week, start_time
)
update public.shift_blocks s
   set start_time = case when m.day_of_week >= 5 then '09:00' else '06:00' end,
       end_time   = case when m.day_of_week >= 5 then '11:00' else '08:00' end
  from morning m
 where s.id = m.id;

-- 4. Data retention: availabilities are deleted after 6 months (privacy policy section 4).
--    Same function as in 009, plus the availabilities rule.
create or replace function public.purge_expired_data()
returns table (category text, deleted bigint)
language plpgsql security definer set search_path = public as $$
begin
  category := 'accounts (no membership, inactive > 1 year)';
  with d as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.role = 'member' and p.membership_end is null
      and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '1 year'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'unconfirmed sign-ups > 7 days';
  with d as (
    delete from auth.users
    where email_confirmed_at is null and created_at < now() - interval '7 days'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'attendance logs > 6 months';
  with d as (
    delete from public.attendance_logs
    where coalesce(check_in, created_at) < now() - interval '6 months'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'availabilities > 6 months';
  with d as (
    delete from public.availabilities
    where week_start < current_date - interval '6 months'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'notifications > 90 days';
  with d as (
    delete from public.notifications
    where created_at < now() - interval '90 days'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'member card edit log > 1 year';
  with d as (
    delete from public.profile_edits
    where created_at < now() - interval '1 year'
    returning 1
  ) select count(*) into deleted from d;
  return next;

  category := 'feedback reports > 1 year';
  with d as (
    delete from public.issues
    where created_at < now() - interval '1 year'
    returning 1
  ) select count(*) into deleted from d;
  return next;
end;
$$;
revoke execute on function public.purge_expired_data() from public, anon, authenticated;

notify pgrst, 'reload schema';
