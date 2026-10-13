-- ─────────────────────────────────────────
-- 007: members and guests must not see which supervisor covers which shift
-- Safe to re-run. Apply inside a transaction.
--
-- RLS works per row, but the schedule rows themselves are public — so the
-- supervisor columns are hidden with column privileges instead. Everyone sees
-- WHEN the gym is open (is_claimed); only staff learn WHO covers it, through
-- staff_assignments(). Realtime respects column privileges, so change events
-- reach members without the hidden columns.
-- ─────────────────────────────────────────

-- 1. Claimed flag that everyone may read (derived, can't drift from supervisor_id)
alter table public.shift_blocks
  add column if not exists is_claimed boolean generated always as (supervisor_id is not null) stored;

-- 2. Column privileges: drop table-wide SELECT, re-grant only the public columns.
--    Not granted: supervisor_id, supervisor_name and the legacy "trainer" column
--    (on spontaneous_openings it holds the supervisor's name).
revoke select on public.shift_blocks from anon, authenticated;
grant select (id, title, day_of_week, start_time, end_time, capacity, enrolled, color, created_at, is_claimed)
  on public.shift_blocks to anon, authenticated;

revoke select on public.spontaneous_openings from anon, authenticated;
grant select (id, title, date, start_time, end_time, capacity, enrolled, note, created_at)
  on public.spontaneous_openings to anon, authenticated;

-- 3. Who covers what — supervisors and admins only (members get an empty result)
create or replace function public.staff_assignments()
returns table (kind text, id uuid, supervisor_id uuid, supervisor_name text)
language sql stable security definer set search_path = public as $$
  select 'shift', s.id, s.supervisor_id, s.supervisor_name
    from public.shift_blocks s
   where s.supervisor_id is not null
     and public.app_role() in ('supervisor', 'admin')
  union all
  select 'spontaneous', o.id, o.supervisor_id, coalesce(o.supervisor_name, nullif(o.trainer, ''))
    from public.spontaneous_openings o
   where public.app_role() in ('supervisor', 'admin');
$$;
revoke execute on function public.staff_assignments() from public, anon;
grant execute on function public.staff_assignments() to authenticated;

-- 4. Existing broadcast notifications named the supervisor ("Max cancelled a shift …").
--    Rewrite them the way the app phrases these messages from now on.
update public.notifications
   set message = regexp_replace(message, '^(⚠️ )?.*? cancelled a shift', 'A shift was cancelled')
 where user_id is null and message ~ ' cancelled a shift';

update public.notifications
   set message = regexp_replace(message, ' by [^.]+\.$', '.')
 where user_id is null and message ~ ' by [^.]+\.$';

-- 5. Make the API pick up is_claimed and the new grants immediately
--    (pgrst_ddl_watch does this too; explicit so it never depends on that trigger)
notify pgrst, 'reload schema';
