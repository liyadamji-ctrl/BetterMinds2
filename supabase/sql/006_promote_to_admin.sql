-- Run this ONCE PER ADMIN, after that person has already signed up through
-- the running app (or been added via Supabase Dashboard > Authentication >
-- Users > Add user). Replace the email below, then run in the SQL Editor.

update public.profiles
set role = 'ADMIN'
where email = 'you@example.com';

-- Confirm it worked:
select id, email, role from public.profiles where email = 'you@example.com';
