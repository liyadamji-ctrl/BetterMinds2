-- Saved searches for the customer "Programs" and "Internships" pages.
-- Each row is one past search; the page rebuilds the external search links
-- from it. See src/features/discovery/.

create table public.discovery_searches (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('PROGRAM', 'INTERNSHIP')),
  query text not null,
  filters_json text not null default '{}',
  keywords_json text not null default '[]',
  created_at timestamptz not null default now()
);

create index discovery_searches_user_kind_idx
  on public.discovery_searches (user_id, kind, created_at desc);

-- RLS: same story as the other *.sql files — the app's server-side checks do
-- the real protection (Prisma bypasses RLS); this is the safety net for
-- direct browser-side Supabase-client access.
alter table public.discovery_searches enable row level security;

create policy "discovery_searches: owner full access" on public.discovery_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
