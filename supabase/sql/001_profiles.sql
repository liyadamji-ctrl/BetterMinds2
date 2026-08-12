-- Profiles: one row per user. Supabase's own `auth.users` table holds
-- email/password/OAuth identity; this table holds the app-specific fields.
-- The two are linked 1:1 by a shared UUID.
--
-- Rows are created automatically by the trigger in 004_new_user_trigger.sql
-- whenever someone signs up. Never insert by hand except to promote an admin (006).

create table public.profiles (
  id               uuid        primary key references auth.users (id) on delete cascade,
  email            text        not null unique,
  name             text,
  role             text        not null default 'CUSTOMER'
                               check (role in ('CUSTOMER', 'COMPANY', 'ADMIN')),
  needs_onboarding boolean     not null default true,
  profile_json     text,
  created_at       timestamptz not null default now()
);
