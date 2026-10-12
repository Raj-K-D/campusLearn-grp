-- ============================================================
-- CAMPUSLEARN — Batch Enrollment System Schema
-- Run these in your Supabase SQL Editor
-- ============================================================

-- 1. BATCH LINKS TABLE
-- Created by teachers/admins to generate magic enrollment links
create table if not exists batch_links (
  id               uuid default uuid_generate_v4() primary key,
  token            text not null unique,           -- URL-safe random token (e.g. "abc123xyz789")
  access_code      text not null,                  -- 6-char PIN/Code (e.g. "A3X9MK")
  school_id        text not null,
  school_name      text not null,
  degree_id        text not null,
  degree_name      text not null,
  branch_id        text not null,
  branch_name      text not null,
  branch_code      text not null,                  -- lowercase branch key (e.g. "cs", "it")
  batch_id         text not null,
  batch_name       text not null,
  section          text not null check (section in ('A','B','C','D','E')),
  current_semester int  not null check (current_semester between 1 and 8),
  is_active        boolean not null default true,  -- teacher can deactivate
  created_at       timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. BATCH ENROLLMENTS TABLE
-- Each row = one student who clicked and completed enrollment via a magic link
create table if not exists batch_enrollments (
  id              uuid default uuid_generate_v4() primary key,
  batch_link_id   uuid references batch_links(id) on delete cascade not null,
  full_name       text not null,
  roll_no         text not null,
  enroll_no       text not null,
  enrolled_at     timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Prevent duplicate roll numbers per batch link
  unique (batch_link_id, roll_no)
);

-- 3. ENABLE ROW LEVEL SECURITY
alter table batch_links       enable row level security;
alter table batch_enrollments enable row level security;

-- 4. POLICIES

-- batch_links: public can SELECT (needed for token resolution in EnrollPage)
create policy "batch_links_public_select"
  on batch_links for select using (true);

-- batch_links: only authenticated users (admin/teacher) can INSERT/UPDATE/DELETE
create policy "batch_links_auth_insert"
  on batch_links for insert with check (auth.role() = 'authenticated');

create policy "batch_links_auth_update"
  on batch_links for update using (auth.role() = 'authenticated');

create policy "batch_links_auth_delete"
  on batch_links for delete using (auth.role() = 'authenticated');

-- batch_enrollments: public can INSERT (students self-enroll without an account)
create policy "batch_enrollments_public_insert"
  on batch_enrollments for insert with check (true);

-- batch_enrollments: only authenticated users can SELECT (admin views enrollment roster)
create policy "batch_enrollments_auth_select"
  on batch_enrollments for select using (auth.role() = 'authenticated');

-- batch_enrollments: no delete/update for safety (enrollment is permanent)
-- ============================================================
-- DONE — The app is now ready for batch enrollment!
-- ============================================================
