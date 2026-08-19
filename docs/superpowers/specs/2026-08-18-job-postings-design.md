# Job Postings — Design

Date: 2026-08-18
Status: Approved

## Purpose

Companies can currently reach a "Post a Job" screen that is a placeholder
(`src/app/(company)/company/jobs/new/page.tsx`) — nothing is persisted and
nothing is shown to job seekers. This feature makes job postings real:
companies create/manage postings, and customers (job seekers) can browse
open postings and apply to them using a resume they've already built with
the resume builder.

## Scope

In scope:
- Company: create, edit, close/reopen, delete job postings; view applicants
  per posting; change an applicant's status.
- Customer: browse/filter open postings across all companies; view a
  posting's detail; apply with one of their existing resumes + an optional
  note; view their own application history and statuses.
- Company dashboard stat tiles (`/company`) wired to real counts.

Out of scope (explicitly not building):
- Resume upload as part of applying — applicants must use an existing
  resume-builder `Resume` row. (The separate resume-analyzer feature's
  extracted text is unrelated and not reused here.)
- Messaging between company and applicant.
- Notifications/emails on status change or new application.
- Search ranking/relevance, pagination — the postings list is expected to
  stay small; a single page is fine for now.
- A generic "posting" abstraction for future content types — YAGNI; build
  the `Job`/`Application` tables this feature actually needs.

## Data model

Two new tables, following the existing `resumes` / `resume_analyses`
convention: Prisma model with `@map`-ed snake_case columns, a matching
Supabase SQL migration, RLS as a safety net (Prisma itself bypasses RLS via
the `postgres` role — see `supabase/sql/005_rls_policies.sql` for why).

### `Job` → `jobs`

| Prisma field     | Column           | Type      | Notes                                              |
|------------------|------------------|-----------|-----------------------------------------------------|
| id               | id               | text PK   | `cuid()`, same pattern as `Resume.id`               |
| companyId        | company_id       | uuid      | FK → `profiles.id`, `onDelete: Cascade`             |
| title            | title            | text      | required                                            |
| description      | description      | text      | required — the role description                    |
| requirements     | requirements     | text?     | optional — qualifications/requirements              |
| employmentType   | employment_type  | text      | `INTERNSHIP` \| `PART_TIME` \| `FULL_TIME`          |
| hoursPerWeek     | hours_per_week   | int?      | optional                                            |
| weeksPerYear     | weeks_per_year   | int?      | optional                                            |
| pay              | pay              | text?     | optional, free text (e.g. "$20/hr", "Unpaid")       |
| location         | location         | text?     | optional, free text (city/region)                   |
| locationType     | location_type    | text      | `REMOTE` \| `ON_SITE` \| `HYBRID`                   |
| status           | status           | text      | `OPEN` \| `CLOSED`, default `OPEN`                  |
| createdAt        | created_at       | timestamptz | default now()                                     |
| updatedAt        | updated_at       | timestamptz | `set_updated_at()` trigger (reused from 002)      |

Index on `company_id`. Index on `status` (the customer listing filters on
`status = 'OPEN'` and will grow to be the most common query).

### `Application` → `applications`

| Prisma field | Column      | Type    | Notes                                                |
|--------------|-------------|---------|-------------------------------------------------------|
| id           | id          | text PK | `cuid()`                                              |
| jobId        | job_id      | text    | FK → `jobs.id`, `onDelete: Cascade`                   |
| userId       | user_id     | uuid    | FK → `profiles.id`, `onDelete: Cascade` — the applicant |
| resumeId     | resume_id   | text    | FK → `resumes.id`, `onDelete: Cascade`                |
| note         | note        | text?   | optional message from applicant                       |
| status       | status      | text    | `SUBMITTED` \| `REVIEWED` \| `SHORTLISTED` \| `REJECTED`, default `SUBMITTED` |
| createdAt    | created_at  | timestamptz | default now()                                     |
| updatedAt    | updated_at  | timestamptz | `set_updated_at()` trigger                        |

Unique constraint on `(job_id, user_id)` — one application per person per
job. Index on `job_id` (company's applicant list) and `user_id` (customer's
"My Applications").

### Profile relations added
`Profile.jobsPosted Job[]` (via `companyId`), `Profile.applications
Application[]` (via `userId`). `Resume.applications Application[]` (via
`resumeId`).

### RLS (`supabase/sql/008_jobs.sql`)
- `jobs`: owner (company) full access; additionally, anyone authenticated
  can `SELECT` rows where `status = 'OPEN'` (customers need to read other
  companies' open postings directly if ever queried client-side; the app
  itself reads via Prisma/server components which bypass RLS regardless).
- `applications`: applicant can `INSERT`/`SELECT` their own; the owning
  company (via a join back to `jobs.company_id`) can `SELECT`/`UPDATE` rows
  for their own postings.

## Routes and components

Everything follows the existing pattern: server component pages read
straight from `db` for display; client components call API routes for
mutations (create/update/delete/apply).

### Shared
- `src/features/jobs/lib/types.ts` — `EMPLOYMENT_TYPES`,
  `LOCATION_TYPES`, `APPLICATION_STATUSES` constants + zod schemas:
  `createJobSchema`, `updateJobSchema`, `applySchema`,
  `updateApplicationStatusSchema`.
- `src/components/ui/Field.tsx` — add a new `SelectField` export (pure
  addition; existing `TextField`/`TextAreaField` untouched) for
  `employmentType`, `locationType`, and applicant `status` dropdowns.

### Company side
- `src/app/(company)/company/jobs/page.tsx` (replace placeholder) — list
  of the company's own postings: title, status badge, applicant count,
  links to Edit / view Applicants, inline Open⇄Closed toggle and Delete
  (client component for the action buttons).
- `src/app/(company)/company/jobs/new/page.tsx` (replace placeholder) —
  renders `JobForm` in create mode.
- `src/app/(company)/company/jobs/[id]/edit/page.tsx` (new) — loads the
  owned job, renders `JobForm` in edit mode.
- `src/features/jobs/components/company/JobForm.tsx` (new) — one client
  component for both create and edit (mirrors `WizardForm`'s shape:
  local state, submit to API, `router.push` on success).
- `src/app/(company)/company/jobs/[id]/applicants/page.tsx` (new) — loads
  applicants for the owned job (joined with applicant profile + resume
  title), renders `ApplicantsList`.
- `src/features/jobs/components/company/ApplicantsList.tsx` (new) —
  client component: status dropdown per row (PATCH on change), link to
  view/export the attached resume (reuses the existing resume detail/export
  route).
- `src/app/(company)/company/page.tsx` (modify) — replace the three
  hardcoded `0` stat tiles with real counts: open postings, total
  applicants across all postings, shortlisted count.

### Customer side
- `src/app/(customer)/jobs/page.tsx` (new) — reads `searchParams` (`type`,
  `q`), queries `db.job.findMany({ where: { status: "OPEN", ... } })`,
  renders a filter bar (`JobFilters`, a small client component that pushes
  new search params) + a list of postings (title, company name, type,
  location, pay if present).
- `src/app/(customer)/jobs/[id]/page.tsx` (new) — full posting detail +
  `ApplyButton`.
- `src/features/jobs/components/customer/ApplyButton.tsx` (new) — client
  component. Loads the customer's resumes (passed in as a prop from the
  server component) to populate a resume picker + optional note textarea;
  POSTs to the apply endpoint; shows "Applied" (with their status) after
  success or if `initialApplication` prop shows they already applied. If
  the customer has zero resumes, shows a prompt linking to
  `/resume-builder` instead of the picker.
- `src/app/(customer)/jobs/applications/page.tsx` (new) — "My
  Applications": server component listing the customer's own applications
  (job title, company name, applied date, status).
- `src/components/CustomerNav.tsx` (modify) — add "Jobs" and "My
  Applications" links alongside the existing "New resume" / "Analyze
  resume" links.

### API routes
- `POST /api/company/jobs` — create (company only).
- `PATCH /api/company/jobs/[id]` — update fields and/or `status`
  (owner only).
- `DELETE /api/company/jobs/[id]` — delete (owner only; cascades
  applications).
- `POST /api/jobs/[id]/apply` — create an application (customer only;
  job must be `OPEN`; 409 if already applied; validates the chosen
  `resumeId` belongs to the caller).
- `PATCH /api/company/applications/[id]` — update an application's status
  (only the company that owns the parent job).

No GET API routes are needed — every list/detail view above is a server
component reading `db` directly, matching how `dashboard/page.tsx` and
`resume-builder/page.tsx` already work.

## Error handling & edge cases
- Guards mirror existing code exactly: `requireCompany()` on every company
  route/page, `requireUser()` (any signed-in role) on customer job pages —
  reusing whichever guard already exists rather than adding new ones.
- Ownership checks: company routes verify `job.companyId === session.userId`
  before mutating, same `loadOwned*` helper pattern as
  `src/app/api/resumes/[id]/route.ts`.
- Re-apply attempts return a 409 with a friendly message; `ApplyButton`
  also pre-empts this by checking the `initialApplication` prop.
- Applying with a `resumeId` that isn't the caller's own resume is
  rejected server-side (400) even though the picker only ever offers the
  caller's own resumes.
- Closing a posting (`status: "CLOSED"`) only affects its visibility on
  `/jobs`; existing applications and their statuses are untouched, and the
  posting still shows in the company's own `/company/jobs` list and on
  `/jobs/applications` for anyone who already applied.
- Deleting a posting cascades its applications (DB `onDelete: Cascade`);
  the company jobs list will confirm before calling delete.

## Testing plan
- `npm run lint` and `npm run build` after implementation, same
  verification bar as the resume-analyzer feature.
- Manual smoke test in the browser (dev server) covering: company creates
  a posting → appears on `/jobs` for a customer → customer applies with a
  resume → applicant appears in the company's applicants list → company
  changes status → reflected on customer's `/jobs/applications` → company
  closes the posting → disappears from `/jobs` but stays in
  `/company/jobs` and `/jobs/applications`.
