-- ════════════════════════════════════════════════════
-- Run this once in Supabase → SQL Editor
-- ════════════════════════════════════════════════════

-- 1. Blocked dates (days Tina marks as unavailable)
create table if not exists blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  created_at timestamptz default now()
);

-- 2. Bookings (customer inquiries)
create table if not exists bookings (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  names             text not null,
  email             text not null,
  package           text not null,
  duration_days     int  not null,
  start_date        date,
  location          text,
  intention         text,
  experience        text,
  photography_addon boolean default false,
  hotel             text,
  notes             text,
  status            text default 'new',
  admin_notes       text default ''
);

-- 3. Enable Row Level Security
alter table blocked_dates enable row level security;
alter table bookings       enable row level security;

-- 4. blocked_dates: anyone can read, only admin (logged-in) can write
create policy "Public read blocked dates"
  on blocked_dates for select
  using (true);

create policy "Authenticated manage blocked dates"
  on blocked_dates for all
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5. bookings: anyone can submit (the form), only admin can read/update
create policy "Public submit bookings"
  on bookings for insert
  with check (true);

create policy "Authenticated manage bookings"
  on bookings for all
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
