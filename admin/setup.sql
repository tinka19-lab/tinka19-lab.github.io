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

-- ════════════════════════════════════════════════════
-- Run the block below AFTER the tables above exist
-- ════════════════════════════════════════════════════

-- 6. Experience days (editable timeline content)
create table if not exists experience_days (
  id           uuid primary key default gen_random_uuid(),
  show_for     text not null check (show_for in ('both','3','5')),
  day_number   integer not null,
  title        text not null,
  paragraphs   jsonb not null default '[]',
  photo_url    text,
  photo_alt    text,
  sort_order   integer not null,
  updated_at   timestamptz default now()
);

alter table experience_days enable row level security;

create policy "Public read experience days"
  on experience_days for select using (true);

create policy "Authenticated manage experience days"
  on experience_days for all
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Seed initial content (matches current HTML — run once)
insert into experience_days (show_for, day_number, title, paragraphs, photo_url, photo_alt, sort_order) values

('both', 1, 'Arrival & Awakening',
 '["You arrive. You breathe. The pace of ordinary life begins to fall away.", "Your first evening begins with a champagne reception and fruit platter in your suite — a moment to arrive fully into this experience together. Waiting for you is the carefully curated Tantric Wellness Box, filled with sensory gifts that will guide you into intention setting and arriving in your bodies. That evening, I guide you through your first ritual: an Awakening the Senses ceremony designed to bring you into your bodies and out of your heads.", "No agenda. No performance. Just presence."]'::jsonb,
 'Photos/Tier%202.playful%20couple.png', 'Couple dancing in light room', 10),

('3', 2, 'Your Personalised Session',
 '["This is the heart of your three-day experience — a session designed entirely around you as a couple.", "Based on your intentions and what feels most alive for you, I curate your session from practices including Polarity & Desire work, Tantric sexuality teachings, conscious touch techniques, or conscious communication. No two sessions are the same. Everything is tailored to where you are and what you need most.", "This day can also be complemented by the optional Photography Add-On — capturing this moment in images that honour its depth."]'::jsonb,
 'Photos/connection.png', 'Shadow of couple in golden light', 20),

('3', 3, 'Integration & Closing Ritual',
 '["Your final morning begins with a closing integration ceremony — a space to honour what has shifted and anchor it into your bodies and your relationship.", "You receive your personalised Lovers'' Ritual Companion: guided practices, rituals, and assignments curated by me to continue this journey at home, at your own pace.", "You leave not with the end of something, but with a beginning."]'::jsonb,
 'Photos/christin-hume-0MoF-Fe0w0A-unsplash.jpg', 'Woman in Vienna park, autumn light', 30),

('5', 2, 'Polarity & Desire',
 '["This is the day most couples describe as the one that changed everything.", "Through guided breathwork, visualization meditation, and Tantric sexuality teachings, you explore the sacred dance of masculine and feminine energy — the polarity that creates magnetic desire.", "All practices are clothed. Nothing is forced. Everything is invited."]'::jsonb,
 'Photos/connection.png', 'Shadow of couple in golden light', 40),

('5', 3, 'The Body Remembers',
 '["Today is devoted to conscious touch. You will learn the foundations of Tantric massage and the art of giving and receiving — not as technique, but as devotion.", "I guide you through a Taoist heart-opening massage followed by a heart-to-sex connection meditation. You will discover how much tenderness lives in your hands, and how much your body has been waiting to be truly met."]'::jsonb,
 'Photos/Tier%202.massage-a-domicile-nMVUTY8_gGw-unsplash.jpg', 'Hands giving massage, warm skin', 50),

('5', 4, 'Voice, Truth & Intimacy',
 '["Today I guide you through conscious communication — not therapy, but a somatic approach to being truly heard and truly seen.", "Many couples carry years of unspoken needs. Today those patterns gently surface and soften. The afternoon is yours — to explore Vienna, to rest, to be together in a new way."]'::jsonb,
 'Photos/alexander-mass-GxiuaFqztCY-unsplash.jpg', 'Couple embracing in Vienna', 60),

('5', 5, 'Integration & Closing Ritual',
 '["Your final morning begins with a Yoni-Lingam honoring ritual — a practice of deep reverence for each other''s body and essence.", "After your closing integration ceremony with me, you receive your personalised Lovers'' Ritual Companion — a bespoke guide to continue this work at home.", "You leave not with the end of something, but with a beginning."]'::jsonb,
 'Photos/christin-hume-0MoF-Fe0w0A-unsplash.jpg', 'Woman in Vienna park, autumn leaves', 70);

-- 7. Storage bucket for experience photos
insert into storage.buckets (id, name, public)
values ('experience-photos', 'experience-photos', true)
on conflict (id) do nothing;

create policy "Public read experience photos"
  on storage.objects for select
  using (bucket_id = 'experience-photos');

create policy "Authenticated upload experience photos"
  on storage.objects for insert
  with check (bucket_id = 'experience-photos' and auth.role() = 'authenticated');

create policy "Authenticated update experience photos"
  on storage.objects for update
  using (bucket_id = 'experience-photos' and auth.role() = 'authenticated');

create policy "Authenticated delete experience photos"
  on storage.objects for delete
  using (bucket_id = 'experience-photos' and auth.role() = 'authenticated');
