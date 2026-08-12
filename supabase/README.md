# Supabase setup

This app's database and authentication (including Google sign-in) both run on
[Supabase](https://supabase.com) — a free-tier hosted Postgres + auth service.
Follow these steps in order once, then the app just works.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is
   enough for this).
2. Pick a strong database password when asked and **save it somewhere** — you'll
   need it for the connection string in step 3.
3. Wait for the project to finish provisioning (~2 minutes).

## 2. Run the SQL scripts

In the Supabase dashboard, open **SQL Editor** → **New query**, and run each
file in this folder **in order**, one at a time:

1. `sql/001_profiles.sql`
2. `sql/002_resumes.sql`
3. `sql/003_consent_and_sessions.sql`
4. `sql/004_new_user_trigger.sql`
5. `sql/005_rls_policies.sql`

(`sql/006_promote_to_admin.sql` comes later, in step 6.)

If a script errors, read the message — it's almost always "already exists"
from re-running one, which is safe to ignore.

## 3. Get your API keys and connection strings

**Project API keys** — Project Settings → API:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Database connection strings** — Project Settings → Database → Connection string:
- Click the **Transaction pooler** tab (port 6543) → copy the URL → `DATABASE_URL`. Append `?pgbouncer=true` to the end if it's not already there.

Copy `.env.example` to `.env` and fill in all three values.

## 4. Turn on Google sign-in (optional, but you asked for it)

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
1. Create a project (or use an existing one).
2. **APIs & Services → OAuth consent screen** — set it up (External, fill in
   the required fields — this can stay in "Testing" mode while you build).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   type **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (find `<your-project-ref>` in your Supabase Project URL).
5. Save — you'll get a **Client ID** and **Client Secret**.

**Back in Supabase** — Authentication → Providers → Google:
1. Toggle it on.
2. Paste in the Client ID and Client Secret from Google.
3. Save.

That's it — the app's login page already has a "Continue with Google" button
wired up (`src/features/auth/components/LoginForm.tsx`); it starts working the
moment the provider is enabled, no code changes needed.

## 5. Restart the app

```bash
npm run dev
```

## 6. Create your admin account

There's no admin signup form on purpose (see `ARCHITECTURE.md`). Instead:

1. Sign up through the app normally at `/signup` (or sign in with Google) —
   this creates a `CUSTOMER` profile automatically via the trigger from step 2.
2. In the Supabase SQL Editor, open `sql/006_promote_to_admin.sql`, replace
   the placeholder email with the address you just signed up with, and run it.
3. Log out and back in — you'll land on `/admin` instead of `/dashboard`.

Repeat step 6 for every additional admin.

## Where everything actually lives

Every record the app stores — every resume (both the raw answers and the
rendered HTML), every session recording's events, consent choices, and user
profiles — lives in these five Postgres tables inside your Supabase project.
Nothing is stored anywhere else; there's no separate file storage to manage.
