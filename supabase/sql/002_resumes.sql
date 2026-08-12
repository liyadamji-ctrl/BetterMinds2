-- One row per resume a customer has built. `fields_json` is the raw wizard
-- answers (source of truth for re-exporting); `html_content` is what's shown
-- and edited in the browser. See src/features/resume-builder/.

create table public.resumes (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  format text not null,
  title text not null,
  fields_json text not null,
  html_content text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'FINAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resumes_user_id_idx on public.resumes (user_id);

-- Keeps updated_at current on every edit, same as Prisma's @updatedAt.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();
