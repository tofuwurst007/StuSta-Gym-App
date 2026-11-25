-- ─────────────────────────────────────────
-- 012: shifts are planned in periods Friday–Thursday (assigned on Thursday for the
-- period starting the next day), plus availability preferences ("want" vs. "could").
--
-- week_start of shift_assignments and availabilities now is the Friday a period
-- starts on. Existing rows (keyed by Monday) are converted:
--   * assignments: each one moves to the period that contains its actual date
--   * availabilities: period P (Fri P … Thu P+6) gets Mon–Thu from the Monday week
--     P+3 and Fri–Sun from the Monday week P-4. A row is only created where the
--     Mon–Thu part exists, so supervisors who have not entered the coming days yet
--     still show up as "missing" and get reminded.
-- Safe to re-run. Apply inside a transaction.
-- ─────────────────────────────────────────

-- 1. Old Monday checks out
alter table public.shift_assignments drop constraint if exists shift_assignments_week_start_check;
alter table public.availabilities drop constraint if exists availabilities_week_start_check;

-- 2. Preferences: subset of shift_block_ids the supervisor would like most
alter table public.availabilities add column if not exists preferred_block_ids uuid[] not null default '{}';

-- 3. Assignments → period of their date (the mapping is injective per block, and new
--    keys are Fridays while old ones are Mondays, so the primary key never collides)
update public.shift_assignments a
   set week_start = (a.week_start + b.day_of_week)
                  - ((extract(isodow from a.week_start + b.day_of_week)::int - 5 + 7) % 7)
  from public.shift_blocks b
 where b.id = a.shift_block_id
   and extract(isodow from a.week_start) = 1;

-- 4. Availabilities → periods
create temporary table av_monday on commit drop as
  select * from public.availabilities where extract(isodow from week_start) = 1;

insert into public.availabilities (supervisor_id, supervisor_name, week_start, shift_block_ids, note, created_at)
select m.supervisor_id,
       m.supervisor_name,
       m.week_start - 3,
       array(
         select x.bid from unnest(m.shift_block_ids) as x(bid)
           join public.shift_blocks b on b.id = x.bid and b.day_of_week <= 3
         union
         select y.bid from av_monday f, unnest(f.shift_block_ids) as y(bid)
           join public.shift_blocks b on b.id = y.bid and b.day_of_week >= 4
          where f.supervisor_id = m.supervisor_id and f.week_start = m.week_start - 7
       ),
       m.note,
       m.created_at
  from av_monday m
on conflict (supervisor_id, week_start) do nothing;

delete from public.availabilities where extract(isodow from week_start) = 1;

-- 5. New Friday checks
alter table public.shift_assignments add constraint shift_assignments_week_start_check
  check (extract(isodow from week_start) = 5);
alter table public.availabilities add constraint availabilities_week_start_check
  check (extract(isodow from week_start) = 5);

-- 6. Server-set fields: name, timestamp, and preferences only among the available shifts
create or replace function public.availabilities_set_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.supervisor_name := coalesce((select name from public.profiles where id = new.supervisor_id), '');
  new.updated_at := now();
  new.preferred_block_ids := array(
    select p from unnest(coalesce(new.preferred_block_ids, '{}')) as p
     where p = any(coalesce(new.shift_block_ids, '{}')));
  return new;
end;
$$;
revoke execute on function public.availabilities_set_defaults() from public, anon, authenticated;

-- 7. Claim / assign / unassign: same as 011, but weeks start on Friday.
--    An outdated cached app still sends Mondays and gets told to reload.
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
  if extract(isodow from p_week_start) <> 5 then
    raise exception 'The app was updated. Please reload the page.' using errcode = '22023';
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

notify pgrst, 'reload schema';
