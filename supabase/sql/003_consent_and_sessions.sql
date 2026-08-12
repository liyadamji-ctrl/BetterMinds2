-- Whether a customer agreed to session recording, and the recordings
-- themselves (batched rrweb events, captured client-side, ingested by
-- POST /api/session-recording). See src/features/session-recording/.

create table public.consent (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  session_recording_allowed boolean not null default false,
  responded_at timestamptz not null default now()
);

create table public.session_recordings (
  id text primary key, -- client-generated UUID, see RecorderProvider.tsx
  user_id uuid not null references public.profiles (id) on delete cascade,
  events text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_ms integer
);

create index session_recordings_user_id_idx on public.session_recordings (user_id);
