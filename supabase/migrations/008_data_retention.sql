-- ─────────────────────────────────────────
-- 008: automatic data retention (matches section 4 of the privacy policy)
-- Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

-- Deletes everything past its retention period and reports what was removed.
-- Staff accounts (supervisor/admin) are managed by hand and never deleted here.
create or replace function public.purge_expired_data()
returns table (category text, deleted bigint)
language plpgsql security definer set search_path = public as $$
begin
  -- Member accounts: 1 year after the membership ended, or — without a membership —
  -- 1 year without any sign-in. Deleting the auth user cascades to the profile,
  -- notifications, attendance and notification reads.
  category := 'accounts (membership ended > 1 year)';
  with d as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.role = 'member'
      and p.membership_end < current_date - interval '1 year'
    returning 1
  ) select count(*) into deleted from d;
  return next;

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

-- Run daily at 03:30 (after the 03:00 backup). Results: cron.job_run_details.
create extension if not exists pg_cron;
select cron.schedule('purge-expired-data', '30 3 * * *', 'select * from public.purge_expired_data()');
