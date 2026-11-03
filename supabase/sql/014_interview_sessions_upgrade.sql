-- Brings an older interview_sessions table (created before 012 reached its
-- final shape) in line with 012_interview_sessions.sql and the Prisma model.
-- Safe to run on a fresh database (012 already created the final shape, so
-- every step is a no-op) and safe to re-run.
--
-- What changes on an old table:
--   * adds interview_type, status, report_json, overall_score
--   * resume_id and company_name become optional (the simulator works
--     without a resume; external jobs may have no company)
--   * resume_id's foreign key becomes ON DELETE SET NULL, so deleting a
--     resume no longer deletes the customer's practice history
--   * adds the CHECK constraints from 012
-- Existing rows are kept: interview_type is backfilled to 'MIXED' and status
-- to 'IN_PROGRESS' (a report was never stored for them).

alter table public.interview_sessions
  add column if not exists interview_type text,
  add column if not exists status text not null default 'IN_PROGRESS',
  add column if not exists report_json text,
  add column if not exists overall_score integer;

update public.interview_sessions set interview_type = 'MIXED' where interview_type is null;

alter table public.interview_sessions
  alter column interview_type set not null,
  alter column resume_id drop not null,
  alter column company_name drop not null;

alter table public.interview_sessions
  drop constraint if exists interview_sessions_resume_id_fkey;
alter table public.interview_sessions
  add constraint interview_sessions_resume_id_fkey
  foreign key (resume_id) references public.resumes (id) on delete set null;

alter table public.interview_sessions
  drop constraint if exists interview_sessions_interview_type_check;
alter table public.interview_sessions
  add constraint interview_sessions_interview_type_check
  check (interview_type in ('BEHAVIORAL', 'TECHNICAL', 'MIXED'));

alter table public.interview_sessions
  drop constraint if exists interview_sessions_status_check;
alter table public.interview_sessions
  add constraint interview_sessions_status_check
  check (status in ('IN_PROGRESS', 'COMPLETED'));
