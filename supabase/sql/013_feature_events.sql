-- Product-usage log for the admin "Feature usage" page. One row per thing a
-- user did: opening a feature's page ('view') or completing an action in it
-- ('resume_created', 'screening_run', ...). Written server-side only by
-- src/features/analytics/lib/track.ts. The feature ids and their labels live
-- in src/features/analytics/lib/features.ts.
--
-- user_id is nullable + SET NULL on delete so usage history survives an
-- account being deleted.

create table public.feature_events (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references public.profiles (id) on delete set null,
  feature text not null,
  action text not null,
  metadata_json text,
  created_at timestamptz not null default now()
);

create index feature_events_feature_created_idx on public.feature_events (feature, created_at desc);
create index feature_events_user_id_idx on public.feature_events (user_id);
create index feature_events_created_idx on public.feature_events (created_at desc);

-- RLS on with NO policies: only the server (Prisma connects as `postgres`
-- and bypasses RLS) can read or write this table. Browser-side Supabase
-- clients get nothing, which is what we want for an analytics log.
alter table public.feature_events enable row level security;

-- One-time backfill from the tables that already exist, so the admin page
-- shows real history from day one instead of starting at zero. Only runs
-- while feature_events is empty, and skips any source table that has not
-- been created yet (e.g. if 011 / 012 were never run).
do $$
begin
  if exists (select 1 from public.feature_events) then
    return;
  end if;

  insert into public.feature_events (user_id, feature, action, created_at)
    select user_id, 'resume-builder', 'resume_created', created_at from public.resumes;

  if to_regclass('public.resume_analyses') is not null then
    insert into public.feature_events (user_id, feature, action, created_at)
      select user_id, 'resume-analyzer', 'analysis_created', created_at from public.resume_analyses;
  end if;

  if to_regclass('public.cover_letters') is not null then
    insert into public.feature_events (user_id, feature, action, created_at)
      select user_id, 'cover-letters', 'cover_letter_created', created_at from public.cover_letters;
  end if;

  if to_regclass('public.jobs') is not null then
    insert into public.feature_events (user_id, feature, action, created_at)
      select company_id, 'job-postings', 'job_posted', created_at from public.jobs;

    insert into public.feature_events (user_id, feature, action, created_at)
      select user_id, 'job-board', 'applied', created_at from public.applications;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'applications' and column_name = 'screened_at'
    ) then
      insert into public.feature_events (user_id, feature, action, created_at)
        select j.company_id, 'ai-screening', 'application_screened', a.screened_at
        from public.applications a
        join public.jobs j on j.id = a.job_id
        where a.screened_at is not null;
    end if;
  end if;

  if to_regclass('public.interview_sessions') is not null then
    insert into public.feature_events (user_id, feature, action, created_at)
      select user_id, 'interview-simulator', 'session_started', created_at from public.interview_sessions;

    -- An older interview_sessions table has no status column until
    -- 014_interview_sessions_upgrade.sql runs; skip the finished backfill then.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'interview_sessions' and column_name = 'status'
    ) then
      insert into public.feature_events (user_id, feature, action, created_at)
        select user_id, 'interview-simulator', 'session_finished', updated_at
        from public.interview_sessions where status = 'COMPLETED';
    end if;
  end if;

  if to_regclass('public.discovery_searches') is not null then
    insert into public.feature_events (user_id, feature, action, created_at)
      select user_id,
             case kind when 'PROGRAM' then 'programs' else 'internships' end,
             'search_saved',
             created_at
      from public.discovery_searches;
  end if;
end $$;
