-- ─────────────────────────────────────────
-- 006: security hardening + schema fixes
-- Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

-- ─────────────────────────────────────────
-- 1. HELPER: current user's role
-- SECURITY DEFINER so policies on profiles can call it without recursing into RLS.
-- ─────────────────────────────────────────
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;
revoke execute on function public.app_role() from public;
grant execute on function public.app_role() to anon, authenticated;

-- ─────────────────────────────────────────
-- 2. SCHEMA ADDITIONS
-- ─────────────────────────────────────────
alter table public.shift_blocks
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists supervisor_name text,
  alter column title set default '',
  alter column trainer set default '';

alter table public.spontaneous_openings
  add column if not exists supervisor_id uuid references public.profiles(id) on delete set null,
  add column if not exists supervisor_name text,
  add column if not exists note text,
  alter column title set default '',
  alter column trainer set default '';

alter table public.notifications
  add column if not exists type text not null default 'info' check (type in ('info', 'warning', 'alert'));

alter table public.attendance_logs
  add column if not exists user_name text,
  add column if not exists check_out timestamptz;

-- check_in: add with a default first, then backfill from created_at (only when the column is new)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance_logs' and column_name = 'check_in'
  ) then
    alter table public.attendance_logs add column check_in timestamptz not null default now();
    update public.attendance_logs set check_in = created_at where created_at is not null;
  end if;
end $$;

-- Per-user read state for broadcast notifications (user_id is null on the notification itself)
create table if not exists public.notification_reads (
  notification_id uuid references public.notifications(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
create index if not exists notification_reads_user_id_idx on public.notification_reads (user_id);
alter table public.notification_reads enable row level security;

drop policy if exists "Notification reads: select own" on public.notification_reads;
create policy "Notification reads: select own"
  on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Notification reads: insert own" on public.notification_reads;
create policy "Notification reads: insert own"
  on public.notification_reads for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Notification reads: delete own" on public.notification_reads;
create policy "Notification reads: delete own"
  on public.notification_reads for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────
-- 3. PROFILES
-- Members see only themselves; supervisors and admins see everyone.
-- ─────────────────────────────────────────
drop policy if exists "Profiles viewable by all authenticated users" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Profiles: staff read all" on public.profiles;
create policy "Profiles: staff read all"
  on public.profiles for select to authenticated
  using ((select public.app_role()) in ('supervisor', 'admin'));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Profiles: staff update" on public.profiles;
create policy "Profiles: staff update"
  on public.profiles for update to authenticated
  using ((select public.app_role()) in ('supervisor', 'admin'))
  with check ((select public.app_role()) in ('supervisor', 'admin'));

-- RLS can't restrict individual columns, so a trigger guards the sensitive ones.
-- Not SECURITY DEFINER: current_user is the API role, so migrations, the service role
-- and SECURITY DEFINER functions are not restricted.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_role text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'id and created_at cannot be changed' using errcode = '42501';
  end if;

  v_role := public.app_role();

  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and v_role is distinct from 'admin' then
    raise exception 'Only admins can change role or email' using errcode = '42501';
  end if;

  -- Supervisors may only maintain other people's member card details
  if old.id is distinct from auth.uid() and v_role is distinct from 'admin' then
    if old.role = 'admin' then
      raise exception 'Only admins can edit admin profiles' using errcode = '42501';
    end if;
    if (new.name, new.avatar_id, new.avatar_initials) is distinct from (old.name, old.avatar_id, old.avatar_initials) then
      raise exception 'Only admins can change other users'' name or avatar' using errcode = '42501';
    end if;
  end if;

  if (new.house, new.room, new.date_of_birth, new.membership_start, new.membership_end)
       is distinct from (old.house, old.room, old.date_of_birth, old.membership_start, old.membership_end)
     and coalesce(v_role, '') not in ('supervisor', 'admin') then
    raise exception 'Only supervisors and admins can change member card details' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Audit trail is written server-side only, so clients can't forge or erase it.
create or replace function public.log_profile_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  changes jsonb := '{}';
begin
  if auth.uid() is null then
    return null;
  end if;

  foreach f in array array['name', 'role', 'house', 'room', 'date_of_birth', 'membership_start', 'membership_end'] loop
    if old_row -> f is distinct from new_row -> f then
      changes := changes || jsonb_build_object(f, jsonb_build_object('old', old_row -> f, 'new', new_row -> f));
    end if;
  end loop;

  if changes <> '{}' then
    insert into public.profile_edits (profile_id, editor_id, editor_name, changes)
    values (new.id, auth.uid(), (select name from public.profiles where id = auth.uid()), changes);
  end if;

  return null;
end;
$$;
revoke execute on function public.log_profile_edit() from public, anon, authenticated;

drop trigger if exists log_profile_edit on public.profiles;
create trigger log_profile_edit
  after update on public.profiles
  for each row execute function public.log_profile_edit();

drop policy if exists "Supervisors and admins can log edits" on public.profile_edits;
drop policy if exists "Admins delete edits" on public.profile_edits;
revoke insert, update, delete on public.profile_edits from anon, authenticated;

-- Deleting the auth user cascades to profiles (profiles_id_fkey ON DELETE CASCADE)
create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'Only admins can delete users' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  delete from auth.users where id = target;
end;
$$;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ─────────────────────────────────────────
-- 4. ROLE MISMATCH ('trainer' no longer exists; roles are admin / supervisor / member)
-- ─────────────────────────────────────────

-- Shift blocks: only admins edit the plan; supervisors claim via claim_shift()
drop policy if exists "Admins and trainers can manage shift blocks" on public.shift_blocks;
drop policy if exists "Shift blocks: admin manage" on public.shift_blocks;
create policy "Shift blocks: admin manage"
  on public.shift_blocks for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- Atomic claim/unclaim so two supervisors can't take the same shift
create or replace function public.claim_shift(p_shift_id uuid, p_claim boolean)
returns public.shift_blocks language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.app_role();
  v_shift public.shift_blocks;
begin
  if coalesce(v_role, '') not in ('supervisor', 'admin') then
    raise exception 'Only supervisors and admins can claim shifts' using errcode = '42501';
  end if;

  if p_claim then
    update public.shift_blocks
      set supervisor_id = auth.uid(),
          supervisor_name = (select name from public.profiles where id = auth.uid())
      where id = p_shift_id and (supervisor_id is null or supervisor_id = auth.uid())
      returning * into v_shift;
    if not found then
      raise exception 'Shift is already claimed' using errcode = 'P0001';
    end if;
  else
    update public.shift_blocks
      set supervisor_id = null, supervisor_name = null
      where id = p_shift_id and (supervisor_id = auth.uid() or v_role = 'admin')
      returning * into v_shift;
    if not found then
      raise exception 'Shift is not claimed by you' using errcode = 'P0001';
    end if;
  end if;

  return v_shift;
end;
$$;
revoke execute on function public.claim_shift(uuid, boolean) from public, anon;
grant execute on function public.claim_shift(uuid, boolean) to authenticated;

-- Spontaneous openings: admins manage all, supervisors only their own
drop policy if exists "Admins and trainers can manage spontaneous openings" on public.spontaneous_openings;

drop policy if exists "Spontaneous: admin manage" on public.spontaneous_openings;
create policy "Spontaneous: admin manage"
  on public.spontaneous_openings for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

drop policy if exists "Spontaneous: supervisor insert own" on public.spontaneous_openings;
create policy "Spontaneous: supervisor insert own"
  on public.spontaneous_openings for insert to authenticated
  with check ((select public.app_role()) = 'supervisor' and supervisor_id = (select auth.uid()));

drop policy if exists "Spontaneous: supervisor delete own" on public.spontaneous_openings;
create policy "Spontaneous: supervisor delete own"
  on public.spontaneous_openings for delete to authenticated
  using ((select public.app_role()) = 'supervisor' and supervisor_id = (select auth.uid()));

-- Notifications: staff send, users see their own plus broadcasts (user_id is null)
drop policy if exists "Admins can insert notifications" on public.notifications;
drop policy if exists "Notifications: staff insert" on public.notifications;
create policy "Notifications: staff insert"
  on public.notifications for insert to authenticated
  with check ((select public.app_role()) in ('supervisor', 'admin'));

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Attendance
drop policy if exists "Admins can manage all attendance" on public.attendance_logs;
drop policy if exists "Attendance: admin manage" on public.attendance_logs;
create policy "Attendance: admin manage"
  on public.attendance_logs for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- ─────────────────────────────────────────
-- 5. REALTIME
-- ─────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['shift_blocks', 'spontaneous_openings', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 6. ISSUES (feedback form): anyone may report, but not as somebody else
-- ─────────────────────────────────────────
drop policy if exists issues_insert_anyone on public.issues;
drop policy if exists issues_insert on public.issues;
create policy issues_insert
  on public.issues for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'issues_message_len' and conrelid = 'public.issues'::regclass
  ) then
    alter table public.issues
      add constraint issues_message_len check (char_length(message) <= 4000) not valid;
  end if;
end $$;

-- ─────────────────────────────────────────
-- 7. GRANTS HARDENING
-- Must come last: revoke the blanket grants first, then re-grant what the app needs.
-- ─────────────────────────────────────────
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;
grant insert on public.issues to anon;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- Clients may only flip notifications.read; everything else is immutable for them
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

revoke all on public.notification_reads from anon, authenticated;
grant select, insert, delete on public.notification_reads to authenticated;
