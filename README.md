# Focal — Career Platform

A full-stack web application where **job seekers** build resumes, find internships, and prepare for interviews, and **employers** post jobs and screen candidates with AI.

Built with **Next.js 14**, **Supabase** (auth + database), **Prisma 7**, and **Tailwind CSS**.

---

## What's already built

| Area | What's working |
|---|---|
| Auth | Email/password signup with verification, Google OAuth, role-based routing |
| Roles | Job Seeker, Employer, Admin — each with their own protected area |
| Onboarding | Post-signup profile wizard (skippable) |
| Resume builder | Format picker → question wizard → in-browser editor → export to Word |
| Company view | Employer dashboard, job postings list (UI ready, CRUD coming next) |
| Admin view | Overview stats, session recordings list + replay |
| Session recording | Consent banner → rrweb capture → stored in Supabase → admin replay |

---

## Prerequisites

Install these before anything else:

| Tool | Version | Download |
|---|---|---|
| **Node.js** | 18 or later | https://nodejs.org |
| **Git** | Any recent | https://git-scm.com |
| **VS Code** | Any recent | https://code.visualstudio.com |
| **Claude Code** | Latest | https://claude.ai/code |

Verify Node is installed:

```bash
node -v   # should print v18.x or higher
npm -v    # should print 9.x or higher
```

---

## 1 — Clone the repository

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/focal.git
cd focal
```

---

## 2 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New project** — pick a name (e.g. `focal`), set a strong database password, and choose the **US East** region
3. Wait ~2 minutes for it to provision

### Get your API keys

In the Supabase dashboard go to **Project Settings → API** and copy:
- **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Get your database URL

Go to **Project Settings → Database → Connection string**, click the **Transaction pooler** tab (port 6543), and copy the URL → this is your `DATABASE_URL`.

---

## 3 — Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the three values from the step above:

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
DATABASE_URL="postgresql://postgres.xxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

---

## 4 — Run the database setup scripts

Open the **Supabase SQL Editor** (left sidebar in your Supabase project). Run these five files **in order** — copy each file's content and click **Run** before moving to the next.

All files are in the `supabase/sql/` folder of this repo.

| # | File | What it creates |
|---|---|---|
| 1 | `supabase/sql/001_profiles.sql` | `profiles` table (one row per user) |
| 2 | `supabase/sql/002_resumes.sql` | `resumes` table + auto-updated `updated_at` trigger |
| 3 | `supabase/sql/003_consent_and_sessions.sql` | `consent` and `session_recordings` tables |
| 4 | `supabase/sql/004_new_user_trigger.sql` | trigger that auto-creates a profile on every signup |
| 5 | `supabase/sql/005_rls_policies.sql` | Row Level Security policies for all tables |

> **File 6 (`006_promote_to_admin.sql`) is different** — it is a one-time command you run *after* signing up for the first time to give yourself Admin access. See Step 8 below.

After pasting each file, click **Run** and wait for the green "Success" message before pasting the next one.

---

## 5 — Enable Google sign-in (optional)

In **Supabase Dashboard → Authentication → Providers → Google**:
1. Enable the Google provider
2. Follow the [Supabase Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google) to get a Client ID and Secret from Google Cloud Console
3. Add `http://localhost:3000/auth/callback` to the allowed redirect URLs in **Authentication → URL Configuration**

---

## 6 — Enable email confirmations (recommended)

In **Supabase Dashboard → Authentication → Email → Confirm email** — toggle it **on**.

Then set up an SMTP provider so emails actually arrive (Supabase's built-in relay is too rate-limited for real use):

**Easiest option — Gmail:**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security) → enable 2-Step Verification
2. Search **App passwords** → create one for Mail → copy the 16-character code
3. In **Supabase → Authentication → SMTP Settings**:
   - Host: `smtp.gmail.com` · Port: `587`
   - Username: your Gmail address
   - Password: the 16-character app password
   - Sender email: your Gmail address

---

## 7 — Install dependencies and run locally

```bash
npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app should load.

---

## 8 — Create the first admin account

1. Sign up normally through the app at `/signup`
2. In the **Supabase SQL Editor**, open `supabase/sql/006_promote_to_admin.sql` — replace `you@example.com` with the email you just signed up with and click **Run**
3. Log out and log back in — you'll be routed to the Admin dashboard at `/admin`

---

## 9 — Develop with Claude Code

Open the project folder in VS Code, then open a terminal and run:

```bash
claude
```

Claude Code will read the codebase and help you build new features. Some good starting prompts:

- *"Implement the job posting form so employers can create and edit listings"*
- *"Build the resume upload feature on the customer dashboard"*
- *"Add the AI resume analysis feature using the Groq API"*
- *"Create the interview simulation page with camera feed and AI scoring"*
- *"Add the cover letter generator that uses the job posting and resume data"*

---

## Project structure

```
src/
├── app/
│   ├── (auth)/          # /login  /signup
│   ├── (admin)/         # /admin  /admin/sessions
│   ├── (customer)/      # /dashboard  /resume-builder
│   ├── (company)/       # /company  /company/jobs
│   ├── (onboarding)/    # /onboarding  (post-signup wizard)
│   ├── api/             # REST endpoints
│   └── auth/callback/   # OAuth + email-confirm landing route
├── features/
│   ├── auth/            # Guard functions, login/signup/google components
│   ├── onboarding/      # Profile setup wizard
│   ├── resume-builder/  # Format definitions, wizard, editor, export
│   └── session-recording/ # Consent banner, rrweb recorder, session player
├── components/          # Shared UI (nav bars, error boundary, Button, Field)
└── lib/
    ├── supabase/        # client.ts  server.ts  middleware.ts
    ├── db.ts            # Prisma client singleton
    └── env.ts           # Environment variable validation
prisma/
└── schema.prisma        # Database schema (kept in sync with Supabase by hand)
supabase/
└── sql/                 # SQL files — run in order in Supabase SQL Editor
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Auth | Supabase Auth (email + Google OAuth) |
| Database | Supabase Postgres via Prisma 7 |
| Styling | Tailwind CSS v4 |
| Session recording | rrweb |
| Resume export | docx (Word format) |

---

## Features left to build (great Claude Code practice!)

- [ ] Resume upload + AI analysis (Groq API)
- [ ] Job posting CRUD for employers
- [ ] Candidate application flow (job seekers apply to postings)
- [ ] AI resume screening for employers
- [ ] Cover letter generator
- [ ] Interview simulation with camera + AI scoring
- [ ] Internship search (external job boards API)
- [ ] Email follow-up tracking
- [ ] Settings page (update profile, change SMTP/AI provider)
