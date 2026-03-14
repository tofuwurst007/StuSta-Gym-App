-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text,
  role text not null default 'member' check (role in ('admin', 'trainer', 'member')),
  avatar_id text,
  avatar_initials text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by all authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- SHIFT BLOCKS
-- ─────────────────────────────────────────
create table public.shift_blocks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  trainer text not null,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time text not null,
  end_time text not null,
  capacity integer not null default 10,
  enrolled integer not null default 0,
  color text not null default '#6C63FF',
  created_at timestamptz default now()
);
alter table public.shift_blocks enable row level security;

create policy "Shift blocks viewable by everyone"
  on public.shift_blocks for select using (true);

create policy "Admins and trainers can manage shift blocks"
  on public.shift_blocks for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'trainer')
  ));

-- ─────────────────────────────────────────
-- SPONTANEOUS OPENINGS
-- ─────────────────────────────────────────
create table public.spontaneous_openings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  trainer text not null,
  date text not null,
  start_time text not null,
  end_time text not null,
  capacity integer not null default 10,
  enrolled integer not null default 0,
  created_at timestamptz default now()
);
alter table public.spontaneous_openings enable row level security;

create policy "Spontaneous openings viewable by everyone"
  on public.spontaneous_openings for select using (true);

create policy "Admins and trainers can manage spontaneous openings"
  on public.spontaneous_openings for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'trainer')
  ));

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Admins can insert notifications"
  on public.notifications for insert
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'trainer')
  ));

-- ─────────────────────────────────────────
-- ATTENDANCE LOGS
-- ─────────────────────────────────────────
create table public.attendance_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  shift_block_id uuid references public.shift_blocks(id) on delete cascade,
  date text not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late')),
  created_at timestamptz default now()
);
alter table public.attendance_logs enable row level security;

create policy "Users can view own attendance"
  on public.attendance_logs for select
  using (auth.uid() = user_id);

create policy "Admins can manage all attendance"
  on public.attendance_logs for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'trainer')
  ));
