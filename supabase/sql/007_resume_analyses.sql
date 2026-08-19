-- One row per "analyze my resume against this job" run. resume_text is the
-- plain text extracted client-side from the uploaded PDF/DOCX/TXT (the raw
-- file itself is never uploaded or stored). result_json is Groq's full
-- structured response; match_score is duplicated out of it for cheap
-- sorting/display. See src/features/resume-analyzer/.

create table public.resume_analyses (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_name text,
  job_title text not null,
  job_description text,
  resume_text text not null,
  match_score int,
  result_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resume_analyses_user_id_idx on public.resume_analyses (user_id);

-- Reuses the trigger function defined in 002_resumes.sql.
create trigger resume_analyses_set_updated_at
  before update on public.resume_analyses
  for each row execute function public.set_updated_at();

-- RLS: same story as supabase/sql/005_rls_policies.sql — the app's own
-- server-side checks (requireUser() in src/features/auth/lib/guard.ts) are
-- what actually protect this table day to day, since Prisma connects as
-- `postgres` and bypasses RLS. This is the safety net for direct
-- browser-side Supabase-client access.
alter table public.resume_analyses enable row level security;

create policy "resume_analyses: owner full access" on public.resume_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
