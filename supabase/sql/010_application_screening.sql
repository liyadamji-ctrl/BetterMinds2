-- AI screening results for job applications. Filled in when a company runs
-- "Screen with AI" on a job's applicants page. screening_json is Groq's full
-- structured response; match_score is duplicated out of it for cheap
-- sorting/filtering. All columns are nullable: an application that has not
-- been screened yet simply has nulls. See src/features/screening/.
--
-- No new RLS policies needed: the existing "applications: company updates own
-- job's applications" policy from 008_jobs.sql already covers these columns.

alter table public.applications
  add column if not exists match_score int,
  add column if not exists screening_json text,
  add column if not exists screened_at timestamptz;

create index if not exists applications_match_score_idx
  on public.applications (job_id, match_score desc);
