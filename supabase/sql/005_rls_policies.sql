-- Row Level Security. Our Next.js server talks to Postgres directly via
-- Prisma using Supabase's connection string, which connects as the
-- `postgres` role and BYPASSES row level security entirely — so nothing
-- here is what actually protects the app day to day (middleware.ts and the
-- requireUser()/requireAdmin() checks in src/features/auth/lib/guard.ts do
-- that). This is a safety net for a different scenario: if you ever query
-- these tables from the browser with the Supabase client directly (as the
-- signed-in user's own `anon` + JWT identity) instead of going through a
-- Next.js API route, these policies are what stop one user from reading or
-- editing another user's data. Enable it anyway — it costs nothing and
-- covers you if the access pattern ever changes.

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.consent enable row level security;
alter table public.session_recordings enable row level security;

-- profiles: read your own row; admins can read every row.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: admins read all" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- resumes: owner-only, full access.
create policy "resumes: owner full access" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- consent: owner-only, full access.
create policy "consent: owner full access" on public.consent
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- session_recordings: owner can create/read their own; admins can read + delete any.
create policy "recordings: owner insert" on public.session_recordings
  for insert with check (auth.uid() = user_id);

create policy "recordings: owner read own" on public.session_recordings
  for select using (auth.uid() = user_id);

create policy "recordings: admins read all" on public.session_recordings
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "recordings: admins delete" on public.session_recordings
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );
