-- Generated cover letters. Tied to one of the customer's own resumes and
-- either a job posted on this platform or a hand-described external one.
-- See src/features/cover-letters/.

create table public.cover_letters (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id text not null references public.resumes (id) on delete cascade,
  job_id text references public.jobs (id) on delete set null,
  company_name text not null,
  job_title text not null,
  job_description text,
  html_content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cover_letters_user_id_idx on public.cover_letters (user_id);

create trigger cover_letters_set_updated_at
  before update on public.cover_letters
  for each row execute function public.set_updated_at();

-- RLS: same story as every other *.sql file in supabase/sql/ — the app's
-- own server-side checks are what actually protect this table day to
-- day, since Prisma connects as `postgres` and bypasses RLS. This is the
-- safety net for direct browser-side Supabase-client access.
alter table public.cover_letters enable row level security;

create policy "cover_letters: owner full access" on public.cover_letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
