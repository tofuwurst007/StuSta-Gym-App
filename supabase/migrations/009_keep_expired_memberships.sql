-- ─────────────────────────────────────────
-- 009: keep accounts whose membership has ended
-- Replaces purge_expired_data() from 008 without the rule that deleted member
-- accounts 1 year after membership_end. All other retention rules are unchanged.
-- Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

create or replace function public.purge_expired_data()
returns table (category text, deleted bigint)
language plpgsql security definer set search_path = public as $$
begin
  -- Member accounts without any membership: 1 year without a sign-in.
  -- Deleting the auth user cascades to the profile, notifications, attendance
  -- and notification reads. Accounts with a (past) membership are kept.
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
