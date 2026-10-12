
-- 1. Create Subjects Table
create table subjects (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  branch text check (branch in ('CS', 'IT', 'AI', 'ENTC', 'MECH', 'CIVIL')),
  semester int check (semester between 1 and 8),
  icon_url text, -- Optional: URL to an icon/image
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Resources Table (Notes, PPTs, Extras)
create table resources (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  type text check (type in ('note', 'ppt', 'extra')),
  url text not null, -- Link to PDF/Drive/File
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Videos Table
create table videos (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  video_id text not null, -- YouTube Video ID (e.g., dQw4w9WgXcQ)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Quizzes Table
create table quizzes (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade,
  title text not null,
  link text not null, -- Link to Google Form or Quiz Platform
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Enable Row Level Security (RLS)
alter table subjects enable row level security;
alter table resources enable row level security;
alter table videos enable row level security;
alter table quizzes enable row level security;

-- 6. Create Policies (Allow Public Read, Admin Write)
-- Allow everyone to read subjects
create policy "Public subjects are viewable by everyone" on subjects for select using (true);
create policy "Public resources are viewable by everyone" on resources for select using (true);
create policy "Public videos are viewable by everyone" on videos for select using (true);
create policy "Public quizzes are viewable by everyone" on quizzes for select using (true);

-- (For now, allow anyone to insert/update - secure this later!)
create policy "Enable insert for authenticated users only" on subjects for insert with check (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users only" on resources for insert with check (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users only" on videos for insert with check (auth.role() = 'authenticated');
create policy "Enable insert for authenticated users only" on quizzes for insert with check (auth.role() = 'authenticated');

-- 7. Storage Bucket Setup (Materials)
-- Note: You might need to create the 'materials' bucket manually in the Storage dashboard if this fails.
insert into storage.buckets (id, name, public) values ('materials', 'materials', true);

-- Storage Policies
create policy "Public Access" on storage.objects for select using ( bucket_id = 'materials' );
create policy "Auth Upload" on storage.objects for insert with check ( bucket_id = 'materials' and auth.role() = 'authenticated' );
