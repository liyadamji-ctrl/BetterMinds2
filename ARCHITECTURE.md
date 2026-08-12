# Architecture

This app is one Next.js project (App Router) that does both frontend and backend —
pages and API routes live side by side and deploy together as a single unit. Read this
before changing anything; it explains *why* the folders are shaped the way they are, not
just what's in them.

## The big idea: two views, isolated on purpose

There's a **customer** area and an **admin** area. They share the same database and the
same codebase, but three separate mechanisms keep a problem in one from reaching the
other:

1. **Route groups.** `src/app/(customer)/` and `src/app/(admin)/` are separate branches
   of the app. Each has its own `layout.tsx`, so each can fail, redesign, or add features
   independently of the other.
2. **Middleware + a role check in the layout.** `src/middleware.ts` runs before any page
   renders and blocks unauthenticated requests to `/admin/*`, `/dashboard/*`, or
   `/resume-builder/*` outright. It does *not* check whether an authenticated user is
   specifically an admin — Supabase's session client works on Next's Edge runtime, but
   Prisma doesn't, so that DB-backed role check happens one layer in, in
   `src/app/(admin)/layout.tsx` via `requireAdmin()` (`src/features/auth/lib/guard.ts`),
   which runs server-side in the Node.js runtime before any admin page content is
   generated. A customer account is redirected to `/dashboard` before it ever receives
   admin HTML — this isn't a client-side check that could be bypassed.
3. **Error boundaries.** Every layout wraps its content in `<AppErrorBoundary scope="...">`
   (`src/components/AppErrorBoundary.tsx`). If something inside throws, only that
   boundary's content shows a fallback — the nav, the other boundary's content, and the
   rest of the page keep working. Within the customer area, the resume wizard and the
   resume editor are wrapped in their *own* boundaries too, so a crash in one doesn't
   take out the other. This was actually triggered and verified during development —
   see the git history / commit notes for what it caught.

## Folder map

```
src/
├── app/                    Routes only. Pages should stay thin — real logic
│   ├── (auth)/             lives in features/. If a page.tsx is doing more than
│   ├── (customer)/         fetching data and rendering a feature component,
│   ├── (admin)/            that's a sign it should move into features/.
│   └── api/                Route handlers, one folder per resource.
│
├── features/                Where the actual logic lives, grouped by feature —
│   ├── auth/                 not by file type. To understand "how resumes work,"
│   ├── resume-builder/       you read one folder, not five.
│   └── session-recording/    Each has components/ and lib/ as needed.
│
├── components/              Shared, generic UI — buttons, nav, the error boundary.
│   └── ui/                   Nothing feature-specific belongs here.
│
├── lib/                     Cross-cutting infrastructure used by everything:
│   ├── db.ts                  the Prisma client singleton (Postgres, via Supabase)
│   ├── env.ts                  startup env var validation
│   ├── logger.ts               structured logging to logs/app.log
│   └── supabase/                client.ts / server.ts / middleware.ts — see below
│
└── middleware.ts            Route guards — see above.

prisma/
└── schema.prisma            Typed client definitions for the 4 tables (Profile, Resume,
                              Consent, SessionRecording) that actually live in Supabase —
                              see supabase/sql/*.sql for what creates them for real.
```

## How a resume actually gets built

1. `/resume-builder` lists the formats in `features/resume-builder/formats/index.ts`.
   Each format (`classic.ts`, `modern.ts`) defines its own question schema *and* its own
   `render()` function that turns answers into HTML. **To add a new format, copy one of
   these files, change the id/name/styling, and register it in `index.ts` — nothing else
   needs to change.**
2. `/resume-builder/[format]` renders `<WizardForm>` with only the serializable parts of
   the format (id, name, sections — never `render`, which is a function and can't cross
   the server→client boundary. This is a real bug that was hit and fixed during build —
   worth remembering if you ever see "Functions cannot be passed to Client Components").
3. Submitting POSTs to `/api/resumes`, which calls the format's `render()` **on the
   server** to produce HTML, and stores both the raw answers (`fieldsJson`) and the
   rendered HTML (`htmlContent`) on the `Resume` row.
4. `/resume-builder/edit/[id]` shows that HTML in a `contentEditable` div. "Save" PATCHes
   the edited HTML back. **Download PDF** is just `window.print()` with print-specific
   CSS in `globals.css` — no server round trip, no headless-browser dependency to host.
   **Download Word** hits `/api/resumes/[id]/export`, which rebuilds a `.docx` straight
   from `fieldsJson` using the `docx` package (not from the HTML — see
   `features/resume-builder/lib/exportDocx.ts` for why).

## Authentication (Supabase Auth, not our own)

Passwords, sessions, and Google sign-in are handled entirely by Supabase — this app
never sees or stores a password.

- **Sign up / log in** (`features/auth/components/SignupForm.tsx` / `LoginForm.tsx`) call
  `supabase.auth.signUp()` / `signInWithPassword()` directly from the browser using
  `src/lib/supabase/client.ts`. There's no `/api/auth/*` route for these anymore —
  supabase-js talks to Supabase directly and the `@supabase/ssr` cookie helpers keep the
  session in sync with the server.
- **Every new account starts as a `CUSTOMER`.** There is no signup path that creates an
  admin. When Supabase inserts a row into its own `auth.users` table (from either email
  signup or Google), a Postgres trigger (`supabase/sql/004_new_user_trigger.sql`) creates
  the matching `public.profiles` row with `role = 'CUSTOMER'` automatically —
  no application code runs at all. `Profile.id` is literally the same UUID as
  `auth.users.id`.
- **Google sign-in** is the `<GoogleButton>` component
  (`features/auth/components/GoogleButton.tsx`) calling `signInWithOAuth({provider:
  "google"})`. The redirect lands on `src/app/auth/callback/route.ts`, which exchanges
  the one-time code for a real session. See `supabase/README.md` for the one-time Google
  Cloud + Supabase dashboard setup this requires.
- **Making someone an admin** is a deliberate, out-of-band action — see
  `supabase/sql/006_promote_to_admin.sql`. They sign up normally first (so a profile
  exists), then you flip `role` to `'ADMIN'` with a one-line SQL update.
- **Server-side, every request re-derives the session** via `getSession()`
  (`src/features/auth/lib/guard.ts`): ask Supabase who's logged in, then look up their
  `Profile` row by that same UUID for `role`/`name`. `requireUser()` and `requireAdmin()`
  wrap that with a `redirect()` for pages that need it.

## How session recording works, and why it's safe by default

- `ConsentBanner` shows once per account. Nothing records until the user clicks Allow —
  the answer is stored in the `Consent` table, not just localStorage.
- `RecorderProvider` (mounted in both the customer and admin layouts) uses `rrweb` to
  capture DOM events client-side, batches them, and POSTs to `/api/session-recording`
  every 10s and on page unload.
- The ingest route checks the `Consent` table itself before accepting events — it does
  **not** trust the client's word that consent was given. That check is what actually
  protects users, not the banner.
- Admins can replay a session at `/admin/sessions/[id]` via `rrweb-player`, and delete
  one via `DELETE /api/admin/sessions/[id]`. There's no automatic retention/expiry yet —
  add one before this goes anywhere near real users at scale.

## Logging

`src/lib/logger.ts` writes structured JSON lines to `logs/app.log` (gitignored), tagged
with a `scope` (e.g. `"resume-builder"`, `"auth"`, `"admin:sessions"`). Client-side
crashes caught by `AppErrorBoundary` get POSTed to `/api/client-error` and logged under
`client:<scope>`, so you can grep one file for "everything that went wrong in the resume
builder" regardless of whether it happened on the server or in the browser.

## The database layer: Prisma for queries, raw SQL for schema

All five tables live in Supabase Postgres. Two different tools touch them, on purpose:

- **`supabase/sql/*.sql`** is the actual source of truth for the schema — run once, in
  order, in the Supabase SQL Editor (see `supabase/README.md`). This is what you edit if
  you add a column or a table, because it's what a beginner can read, paste, and
  understand without learning Prisma's migration system.
- **`prisma/schema.prisma`** is a hand-kept mirror of those same tables, used only to
  generate a typed `PrismaClient` (`npx prisma generate`) so the app gets autocomplete
  and compile-time errors instead of typos in raw SQL strings. If you change the SQL,
  update `schema.prisma` to match by hand — there's no automatic sync between them.
  (You *can* point `prisma migrate`/`db push` at Supabase's direct connection instead of
  hand-writing SQL, using `DIRECT_URL` — see the comments in `.env.example` — but that's
  a bigger jump and not the default workflow here.)

One Prisma 7 detail worth knowing: `new PrismaClient()` with no arguments throws at
runtime now — it requires an explicit driver adapter. `src/lib/db.ts` passes
`@prisma/adapter-pg`, pointed at `DATABASE_URL` (Supabase's pooled connection string).

Also note the naming: `schema.prisma`'s `Profile` model uses `@map`/`@@map` everywhere
(e.g. `htmlContent` in TypeScript ↔ `html_content` in Postgres) — the SQL is snake_case,
the app code is camelCase, and Prisma bridges the two.

## Deploying

- **App:** push this repo to Vercel. Frontend and API routes deploy together as one
  project — nothing to configure beyond environment variables.
- **Database + Auth:** already on Supabase, already free-tier — nothing to swap.
- **Env vars to set on Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `DATABASE_URL` (and `DIRECT_URL` if you use it). Same values as your `.env`.
- Add your Vercel URL to Supabase's **Authentication → URL Configuration → Redirect URLs**
  (and to the Google Cloud OAuth client's authorized redirect URIs) once you have it, or
  Google/email sign-in will redirect back to `localhost` in production.
- Staging and production should be separate Supabase projects, so testing never touches
  real user data.
