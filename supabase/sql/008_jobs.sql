-- Job/internship postings created by COMPANY-role profiles, and customer
-- applications to them. See src/features/jobs/.

create table public.jobs (
  id text primary key default gen_random_uuid()::text,
  company_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  requirements text,
  employment_type text not null check (employment_type in ('INTERNSHIP', 'PART_TIME', 'FULL_TIME')),
  hours_per_week int,
  weeks_per_year int,
  pay text,
  location text,
  location_type text not null check (location_type in ('REMOTE', 'ON_SITE', 'HYBRID')),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_status_idx on public.jobs (status);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.applications (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id text not null references public.resumes (id) on delete cascade,
  note text,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, user_id)
);

create index applications_job_id_idx on public.applications (job_id);
create index applications_user_id_idx on public.applications (user_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- RLS: same story as supabase/sql/005_rls_policies.sql and 007 — the app's
-- own server-side checks are what actually protect these tables day to
-- day, since Prisma connects as `postgres` and bypasses RLS. This is the
-- safety net for direct browser-side Supabase-client access.
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "jobs: owner full access" on public.jobs
  for all using (auth.uid() = company_id) with check (auth.uid() = company_id);

create policy "jobs: anyone reads open postings" on public.jobs
  for select using (status = 'OPEN');

create policy "applications: applicant insert" on public.applications
  for insert with check (auth.uid() = user_id);

create policy "applications: applicant reads own" on public.applications
  for select using (auth.uid() = user_id);

create policy "applications: company reads own job's applications" on public.applications
  for select using (
    exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
  );

create policy "applications: company updates own job's applications" on public.applications
  for update using (
    exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
  ) with check (
    exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
  );
