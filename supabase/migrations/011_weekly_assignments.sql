-- ─────────────────────────────────────────
-- 011: shift assignments per week
-- Until now a shift block carried one supervisor for every week, so planning next
-- week changed the rest of the current week too. Assignments now live per
-- (shift block, week). The current assignments are carried over to this week
-- and next week. Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

-- 1. Table
create table if not exists public.shift_assignments (
  shift_block_id uuid not null references public.shift_blocks(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  supervisor_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (shift_block_id, week_start)
);
create index if not exists shift_assignments_week_idx on public.shift_assignments (week_start);
alter table public.shift_assignments enable row level security;

-- Everyone may learn WHEN the gym is covered; WHO covers it stays staff-only (as in 007).
-- Writes only through set_shift_assignment().
revoke all on public.shift_assignments from anon, authenticated;
grant select (shift_block_id, week_start) on public.shift_assignments to anon, authenticated;

drop policy if exists "Shift assignments: readable" on public.shift_assignments;
create policy "Shift assignments: readable"
  on public.shift_assignments for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_assignments') then
    alter publication supabase_realtime add table public.shift_assignments;
  end if;
end $$;

-- 2. Who covers what, for staff
create or replace function public.staff_shift_assignments(p_from date, p_to date)
returns table (shift_block_id uuid, week_start date, supervisor_id uuid, supervisor_name text)
language sql stable security definer set search_path = public as $$
  select a.shift_block_id, a.week_start, a.supervisor_id, a.supervisor_name
    from public.shift_assignments a
   where a.week_start between p_from and p_to
     and public.app_role() in ('supervisor', 'admin');
$$;
revoke execute on function public.staff_shift_assignments(date, date) from public, anon;
grant execute on function public.staff_shift_assignments(date, date) to authenticated;

-- 3. Claim / assign / unassign one shift in one week
--    p_supervisor_id = caller  → claim (only while the slot is free)
--    p_supervisor_id = other   → admin assigns (overwrites)
--    p_supervisor_id = null    → unassign (own shift, or admin)
create or replace function public.set_shift_assignment(p_shift_id uuid, p_week_start date, p_supervisor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.app_role();
  v_current uuid;
  v_name text;
begin
  if coalesce(v_role, '') not in ('supervisor', 'admin') then
    raise exception 'Only supervisors and admins can change shifts' using errcode = '42501';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'Week must start on a Monday' using errcode = '22023';
  end if;
  if not exists (select 1 from public.shift_blocks where id = p_shift_id) then
    raise exception 'Shift not found' using errcode = 'P0001';
  end if;

  select supervisor_id into v_current from public.shift_assignments
   where shift_block_id = p_shift_id and week_start = p_week_start
   for update;

  if p_supervisor_id is null then
    if v_current is null then return; end if;
    if v_current is distinct from auth.uid() and v_role <> 'admin' then
      raise exception 'Shift is not claimed by you' using errcode = 'P0001';
    end if;
    delete from public.shift_assignments where shift_block_id = p_shift_id and week_start = p_week_start;
    return;
  end if;

  if p_supervisor_id is distinct from auth.uid() and v_role <> 'admin' then
    raise exception 'Only admins can assign shifts to others' using errcode = '42501';
  end if;
  if v_current is not null and v_current is distinct from p_supervisor_id and v_role <> 'admin' then
    raise exception 'Shift is already claimed' using errcode = 'P0001';
  end if;

  select name into v_name from public.profiles where id = p_supervisor_id and role in ('supervisor', 'admin');
  if not found then
    raise exception 'That user is not a supervisor' using errcode = 'P0001';
  end if;

  if v_role = 'admin' then
    insert into public.shift_assignments (shift_block_id, week_start, supervisor_id, supervisor_name)
    values (p_shift_id, p_week_start, p_supervisor_id, v_name)
    on conflict (shift_block_id, week_start)
    do update set supervisor_id = excluded.supervisor_id, supervisor_name = excluded.supervisor_name, created_at = now();
  else
    -- Two supervisors claiming at once: the second one must lose, never overwrite
    insert into public.shift_assignments (shift_block_id, week_start, supervisor_id, supervisor_name)
    values (p_shift_id, p_week_start, p_supervisor_id, v_name)
    on conflict (shift_block_id, week_start) do nothing;
    if not found and not exists (select 1 from public.shift_assignments
        where shift_block_id = p_shift_id and week_start = p_week_start and supervisor_id = p_supervisor_id) then
      raise exception 'Shift is already claimed' using errcode = 'P0001';
    end if;
  end if;
end;
$$;
revoke execute on function public.set_shift_assignment(uuid, date, uuid) from public, anon;
grant execute on function public.set_shift_assignment(uuid, date, uuid) to authenticated;

-- 4. Carry the current (week-less) assignments over to this week and next week, then clear them
insert into public.shift_assignments (shift_block_id, week_start, supervisor_id, supervisor_name)
select s.id, w.week_start, s.supervisor_id, coalesce(s.supervisor_name, '')
  from public.shift_blocks s
 cross join (values
   (date_trunc('week', now() at time zone 'Europe/Berlin')::date),
   ((date_trunc('week', now() at time zone 'Europe/Berlin') + interval '7 days')::date)
 ) as w(week_start)
 where s.supervisor_id is not null
on conflict (shift_block_id, week_start) do nothing;

update public.shift_blocks set supervisor_id = null, supervisor_name = null where supervisor_id is not null;

-- 5. The old week-less functions must not write anymore (an outdated cached app would call them)
create or replace function public.claim_shift(p_shift_id uuid, p_claim boolean)
returns public.shift_blocks language plpgsql security definer set search_path = public as $$
begin
  raise exception 'The app was updated. Please reload the page.' using errcode = 'P0001';
end;
$$;

create or replace function public.admin_assign_shift(p_shift_id uuid, p_supervisor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'The app was updated. Please reload the page.' using errcode = 'P0001';
end;
$$;

-- 6. Data retention: who worked when is kept 6 months (privacy policy section 4).
--    Same function as in 010, plus the shift assignments rule.
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

  category := 'shift assignments > 6 months';
  with d as (
    delete from public.shift_assignments
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
