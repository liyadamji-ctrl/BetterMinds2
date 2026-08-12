-- Whenever Supabase Auth creates a row in auth.users (email signup OR
-- Google sign-in), this trigger fires and creates the matching
-- public.profiles row automatically.
--
-- It reads `account_type` from the signup metadata set by the SignupForm
-- to assign COMPANY or CUSTOMER. Google users default to CUSTOMER and
-- choose their type during the onboarding wizard.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_account_type text;
  v_role         text;
begin
  v_account_type := new.raw_user_meta_data ->> 'account_type';

  if v_account_type = 'employer' then
    v_role := 'COMPANY';
  else
    v_role := 'CUSTOMER';
  end if;

  insert into public.profiles (id, email, name, role, needs_onboarding)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',       -- email signup sets this
      new.raw_user_meta_data ->> 'full_name'   -- Google sign-in sets this
    ),
    v_role,
    true   -- every new user goes through the onboarding wizard
  )
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
