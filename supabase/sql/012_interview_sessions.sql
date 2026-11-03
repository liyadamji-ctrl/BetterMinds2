-- Interview simulator sessions: generated questions, the customer's spoken
-- (transcribed) answers, per-answer analysis, camera metrics and the final
-- report. Transcripts and numbers only; no audio or video is stored.
-- See src/features/interview/.

create table public.interview_sessions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_id text references public.resumes (id) on delete set null,
  job_id text references public.jobs (id) on delete set null,
  job_title text not null,
  company_name text,
  job_description text,
  interview_type text not null check (interview_type in ('BEHAVIORAL', 'TECHNICAL', 'MIXED')),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  questions_json text not null,
  report_json text,
  overall_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interview_sessions_user_id_idx on public.interview_sessions (user_id);

create trigger interview_sessions_set_updated_at
  before update on public.interview_sessions
  for each row execute function public.set_updated_at();

-- RLS: same as the other *.sql files. The app's server-side checks do the
-- real protection (Prisma bypasses RLS); this guards direct browser access.
alter table public.interview_sessions enable row level security;

create policy "interview_sessions: owner full access" on public.interview_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
