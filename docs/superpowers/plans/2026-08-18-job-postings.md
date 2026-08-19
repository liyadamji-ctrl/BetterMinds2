# Job Postings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Companies can create, edit, close, and delete job postings; customers can browse open postings, filter them, apply with an existing resume, and track their application statuses; companies can view and triage applicants per posting.

**Architecture:** Two new Prisma models (`Job`, `Application`) backed by a new Supabase SQL migration, following the exact pattern already used by `Resume`/`ResumeAnalysis`. Server-component pages read from Prisma directly; client components call new API routes only for mutations (create/update/delete/apply/status-change) — no GET API routes are needed.

**Tech Stack:** Next.js 14 App Router, Prisma 7 (`@prisma/adapter-pg`), Supabase Postgres, zod, Tailwind. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-18-job-postings-design.md](../specs/2026-08-18-job-postings-design.md)

## Global Constraints

- No automated test framework exists in this repo (no jest/vitest). Per-task verification is `npx tsc --noEmit` + `npm run lint`; the final task runs `npm run build` plus a manual browser smoke test. This matches the precedent set by the resume-analyzer feature.
- API routes MUST use `getSession()` from `src/features/auth/lib/guard.ts` + a manual `session.role !== "COMPANY"` check for company-only routes — **never** `requireCompany()`/`requireUser()` inside a Route Handler. Those call Next's `redirect()`, which only works in Server Components/Pages; in a Route Handler it would send an HTTP redirect instead of a JSON error back to `fetch()`.
- Every new Prisma field maps to its snake_case column via `@map(...)`, matching every existing model exactly. (A missing `@map` on `matchScore` was a real bug caught in the resume-analyzer feature — do not repeat it.)
- SQL migrations live in `supabase/sql/*.sql`, numbered sequentially (next is `008_jobs.sql`), and are applied directly against `DATABASE_URL` as part of Task 1 — not left for a human to paste into the Supabase dashboard.
- Reuse `Button`, `TextField`, `TextAreaField` from `src/components/ui/` as-is. The only new shared UI primitive is `SelectField`, added in Task 2.
- The customer resume-*edit* route (`/resume-builder/edit/[id]`) is customer-only (blocked for COMPANY role by `(customer)/layout.tsx`) and is editable (`contentEditable`) — it must never be linked to from the company side. Task 6 renders a **read-only** inline preview of `resume.htmlContent` instead (same `dangerouslySetInnerHTML` pattern already used in `ResumeEditor.tsx`, just without `contentEditable`).

---

### Task 1: Data model — Prisma schema + Supabase migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `supabase/sql/008_jobs.sql`

**Interfaces:**
- Produces: Prisma models `Job` (fields: `id, companyId, title, description, requirements, employmentType, hoursPerWeek, weeksPerYear, pay, location, locationType, status, applications, createdAt, updatedAt`) and `Application` (fields: `id, jobId, job, userId, user, resumeId, resume, note, status, createdAt, updatedAt`); `Profile.jobsPosted`, `Profile.applications`, `Resume.applications` relations. All later tasks depend on `db.job` / `db.application` existing with these exact field names.

- [ ] **Step 1: Add the `Job` and `Application` models to `prisma/schema.prisma`**

  Insert this new section right before the existing `// --- Session recording (admin) --------------------------------------------` comment (i.e. after the `ResumeAnalysis` model):

  ```prisma
  // --- Job postings -----------------------------------------------------

  /// A job/internship posting created by a COMPANY-role profile. See
  /// src/features/jobs/. Visible to customers on /jobs while status is OPEN.
  model Job {
    id        String  @id @default(cuid())
    companyId String  @db.Uuid @map("company_id")
    company   Profile @relation("CompanyJobs", fields: [companyId], references: [id], onDelete: Cascade)

    title       String
    description String
    /// Optional qualifications/requirements text, separate from description.
    requirements String?

    /// "INTERNSHIP" | "PART_TIME" | "FULL_TIME"
    employmentType String @map("employment_type")
    hoursPerWeek   Int?   @map("hours_per_week")
    weeksPerYear   Int?   @map("weeks_per_year")
    /// Free text, e.g. "$20/hr", "$60,000-$70,000/yr", "Unpaid".
    pay            String?

    location     String?
    /// "REMOTE" | "ON_SITE" | "HYBRID"
    locationType String @map("location_type")

    /// "OPEN" | "CLOSED" — only OPEN postings show on the customer /jobs list.
    status String @default("OPEN")

    applications Application[]

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@index([companyId])
    @@index([status])
    @@map("jobs")
  }

  /// One customer's application to one Job, attaching an existing
  /// resume-builder Resume. Unique per (jobId, userId) — one application
  /// per person per posting.
  model Application {
    id String @id @default(cuid())

    jobId String @map("job_id")
    job   Job    @relation(fields: [jobId], references: [id], onDelete: Cascade)

    userId String  @db.Uuid @map("user_id")
    user   Profile @relation("UserApplications", fields: [userId], references: [id], onDelete: Cascade)

    resumeId String @map("resume_id")
    resume   Resume @relation(fields: [resumeId], references: [id], onDelete: Cascade)

    /// Optional short message from the applicant.
    note String?

    /// "SUBMITTED" | "REVIEWED" | "SHORTLISTED" | "REJECTED"
    status String @default("SUBMITTED")

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@unique([jobId, userId])
    @@index([jobId])
    @@index([userId])
    @@map("applications")
  }

  ```

- [ ] **Step 2: Add relations to `Profile` and `Resume`**

  In the `Profile` model, change:
  ```prisma
    resumes           Resume[]
    resumeAnalyses    ResumeAnalysis[]
    consent           Consent?
    sessionRecordings SessionRecording[]
  ```
  to:
  ```prisma
    resumes           Resume[]
    resumeAnalyses    ResumeAnalysis[]
    jobsPosted        Job[]              @relation("CompanyJobs")
    applications      Application[]      @relation("UserApplications")
    consent           Consent?
    sessionRecordings SessionRecording[]
  ```

  In the `Resume` model, add `applications Application[]` right after the `user` relation line:
  ```prisma
  model Resume {
    id     String  @id @default(cuid())
    userId String  @db.Uuid @map("user_id")
    user   Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

    applications Application[]

    format String // matches an id in src/features/resume-builder/formats/*.ts
    title  String
    ...
  ```

- [ ] **Step 3: Regenerate the Prisma client**

  Run: `npx prisma generate`
  Expected: `✔ Generated Prisma Client ... to ./node_modules/@prisma/client`

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit`
  Expected: no errors (schema changes alone don't touch any `.ts` files yet, so this just confirms nothing is currently broken).

- [ ] **Step 5: Create `supabase/sql/008_jobs.sql`**

  ```sql
  -- Job/internship postings created by COMPANY-role profiles, and customer
  -- applications to them. See src/features/jobs/.

  create table public.jobs (
    id text primary key default gen_random_uuid()::text,
    company_id uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    description text not null,
    requirements text,
    employment_type text not null check (employment_type in ('INTERNSHIP', 'PART_TIME', 'FULL_TIME')),
    hours_per_week int,
    weeks_per_year int,
    pay text,
    location text,
    location_type text not null check (location_type in ('REMOTE', 'ON_SITE', 'HYBRID')),
    status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index jobs_company_id_idx on public.jobs (company_id);
  create index jobs_status_idx on public.jobs (status);

  create trigger jobs_set_updated_at
    before update on public.jobs
    for each row execute function public.set_updated_at();

  create table public.applications (
    id text primary key default gen_random_uuid()::text,
    job_id text not null references public.jobs (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    resume_id text not null references public.resumes (id) on delete cascade,
    note text,
    status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'REJECTED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (job_id, user_id)
  );

  create index applications_job_id_idx on public.applications (job_id);
  create index applications_user_id_idx on public.applications (user_id);

  create trigger applications_set_updated_at
    before update on public.applications
    for each row execute function public.set_updated_at();

  -- RLS: same story as supabase/sql/005_rls_policies.sql and 007 — the app's
  -- own server-side checks are what actually protect these tables day to
  -- day, since Prisma connects as `postgres` and bypasses RLS. This is the
  -- safety net for direct browser-side Supabase-client access.
  alter table public.jobs enable row level security;
  alter table public.applications enable row level security;

  create policy "jobs: owner full access" on public.jobs
    for all using (auth.uid() = company_id) with check (auth.uid() = company_id);

  create policy "jobs: anyone reads open postings" on public.jobs
    for select using (status = 'OPEN');

  create policy "applications: applicant insert" on public.applications
    for insert with check (auth.uid() = user_id);

  create policy "applications: applicant reads own" on public.applications
    for select using (auth.uid() = user_id);

  create policy "applications: company reads own job's applications" on public.applications
    for select using (
      exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
    );

  create policy "applications: company updates own job's applications" on public.applications
    for update using (
      exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
    ) with check (
      exists (select 1 from public.jobs j where j.id = job_id and j.company_id = auth.uid())
    );
  ```

- [ ] **Step 6: Apply the migration to the real database**

  There's no `psql` in this environment and this project doesn't use `prisma migrate` (SQL is hand-applied — see the comment at the top of `prisma/schema.prisma`). Apply it with a one-off script using the existing `DATABASE_URL`, splitting the file on top-level semicolons (safe here — this file has no dollar-quoted function bodies, unlike `002_resumes.sql`):

  ```bash
  cat > .tmp-apply-008.ts << 'EOF'
  import "dotenv/config";
  import fs from "node:fs";
  import { db } from "./src/lib/db";

  async function main() {
    const sql = fs.readFileSync("supabase/sql/008_jobs.sql", "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const statement of statements) {
      await db.$executeRawUnsafe(statement);
    }
    console.log(`Applied ${statements.length} statements.`);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-apply-008.ts
  rm -f .tmp-apply-008.ts
  ```
  Expected: `Applied <N> statements.` with no errors.

- [ ] **Step 7: Verify the tables exist with the right columns**

  ```bash
  cat > .tmp-verify-008.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const jobsCols = await db.$queryRawUnsafe(`select column_name from information_schema.columns where table_name = 'jobs' order by ordinal_position`);
    const appsCols = await db.$queryRawUnsafe(`select column_name from information_schema.columns where table_name = 'applications' order by ordinal_position`);
    console.log("jobs:", jobsCols);
    console.log("applications:", appsCols);
    const count = await db.job.count();
    console.log("db.job.count() via Prisma:", count);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-008.ts
  rm -f .tmp-verify-008.ts
  ```
  Expected: both column lists print (confirming `employment_type`, `location_type`, etc. — snake_case, matching the `@map`s from Step 1-2), and `db.job.count()` returns `0` with no Prisma error (this is the exact class of error caught in Task-5-of-the-resume-analyzer-fix — confirming every `@map` is correct).

- [ ] **Step 8: Commit**

  ```bash
  git add prisma/schema.prisma supabase/sql/008_jobs.sql
  git commit -m "$(cat <<'EOF'
  Add Job and Application data model for job postings feature

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Shared types/schemas + `SelectField` UI primitive

**Files:**
- Create: `src/features/jobs/lib/types.ts`
- Modify: `src/components/ui/Field.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: from `src/features/jobs/lib/types.ts` — `EMPLOYMENT_TYPES`, `EMPLOYMENT_TYPE_LABELS`, `LOCATION_TYPES`, `LOCATION_TYPE_LABELS`, `JOB_STATUSES`, `APPLICATION_STATUSES`, `APPLICATION_STATUS_LABELS` constants; `EmploymentType`, `LocationType`, `JobStatus`, `ApplicationStatus` types; `createJobSchema`, `updateJobSchema`, `applySchema`, `updateApplicationStatusSchema` zod schemas. From `Field.tsx` — new export `SelectField({ label, options, error, ...props })` where `options: { value: string; label: string }[]`.

- [ ] **Step 1: Create `src/features/jobs/lib/types.ts`**

  ```typescript
  import { z } from "zod";

  export const EMPLOYMENT_TYPES = ["INTERNSHIP", "PART_TIME", "FULL_TIME"] as const;
  export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

  export const LOCATION_TYPES = ["REMOTE", "ON_SITE", "HYBRID"] as const;
  export type LocationType = (typeof LOCATION_TYPES)[number];

  export const JOB_STATUSES = ["OPEN", "CLOSED"] as const;
  export type JobStatus = (typeof JOB_STATUSES)[number];

  export const APPLICATION_STATUSES = ["SUBMITTED", "REVIEWED", "SHORTLISTED", "REJECTED"] as const;
  export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

  export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
    INTERNSHIP: "Internship",
    PART_TIME: "Part-time",
    FULL_TIME: "Full-time",
  };

  export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
    REMOTE: "Remote",
    ON_SITE: "On-site",
    HYBRID: "Hybrid",
  };

  export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
    SUBMITTED: "Submitted",
    REVIEWED: "Reviewed",
    SHORTLISTED: "Shortlisted",
    REJECTED: "Rejected",
  };

  export const createJobSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(150),
    description: z.string().trim().min(1, "Description is required").max(10000),
    requirements: z.string().trim().max(10000).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    hoursPerWeek: z.coerce.number().int().min(1).max(168).optional(),
    weeksPerYear: z.coerce.number().int().min(1).max(52).optional(),
    pay: z.string().trim().max(100).optional(),
    location: z.string().trim().max(150).optional(),
    locationType: z.enum(LOCATION_TYPES),
  });
  export type CreateJobInput = z.infer<typeof createJobSchema>;

  export const updateJobSchema = createJobSchema.partial().extend({
    status: z.enum(JOB_STATUSES).optional(),
  });
  export type UpdateJobInput = z.infer<typeof updateJobSchema>;

  export const applySchema = z.object({
    resumeId: z.string().min(1, "Choose a resume"),
    note: z.string().trim().max(2000).optional(),
  });
  export type ApplyInput = z.infer<typeof applySchema>;

  export const updateApplicationStatusSchema = z.object({
    status: z.enum(APPLICATION_STATUSES),
  });
  ```

  Note: `hoursPerWeek`/`weeksPerYear` use `z.coerce.number()`, which turns an empty string into `NaN` and fails the `.min()` check even though the field is optional. Every caller (Task 4's `JobForm`) MUST send `undefined` (by omitting the key), never `""`, for these fields when left blank.

- [ ] **Step 2: Add `SelectField` to `src/components/ui/Field.tsx`**

  Change the import line at the top from:
  ```typescript
  import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
  ```
  to:
  ```typescript
  import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
  ```

  Then append this new export at the end of the file (after `TextAreaField`):
  ```typescript
  type SelectOption = { value: string; label: string };

  type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    options: SelectOption[];
    error?: string;
  };

  export function SelectField({ label, options, error, id, className = "", ...props }: SelectProps) {
    const fieldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <select
          id={fieldId}
          className={`rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/jobs/lib/types.ts src/components/ui/Field.tsx
  git commit -m "$(cat <<'EOF'
  Add shared job-posting types/schemas and a SelectField primitive

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Company job API routes (create/update/delete)

**Files:**
- Create: `src/app/api/company/jobs/route.ts`
- Create: `src/app/api/company/jobs/[id]/route.ts`

**Interfaces:**
- Consumes: `db.job` (Task 1), `createJobSchema`/`updateJobSchema` (Task 2), `getSession` from `src/features/auth/lib/guard.ts` (existing).
- Produces: `POST /api/company/jobs` → `{ id }` on success. `PATCH /api/company/jobs/[id]` → `{ job }`. `DELETE /api/company/jobs/[id]` → `{ ok: true }`. All three return `{ error: string }` with 401/403/404/400/500 on failure. Task 4 (`JobForm`) and Task 5 (`JobActions`) call these directly.

- [ ] **Step 1: Create `src/app/api/company/jobs/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { createJobSchema } from "@/features/jobs/lib/types";

  export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (session.role !== "COMPANY") {
      return NextResponse.json({ error: "Only company accounts can post jobs" }, { status: 403 });
    }

    try {
      const body = await request.json();
      const parsed = createJobSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const job = await db.job.create({
        data: {
          companyId: session.userId,
          title: parsed.data.title,
          description: parsed.data.description,
          requirements: parsed.data.requirements,
          employmentType: parsed.data.employmentType,
          hoursPerWeek: parsed.data.hoursPerWeek,
          weeksPerYear: parsed.data.weeksPerYear,
          pay: parsed.data.pay,
          location: parsed.data.location,
          locationType: parsed.data.locationType,
        },
      });

      logger.info("jobs", "Job posted", { jobId: job.id, companyId: session.userId });
      return NextResponse.json({ id: job.id });
    } catch (error) {
      logger.error("jobs", "Create job failed", { error: String(error) });
      return NextResponse.json({ error: "Couldn't create that posting. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create `src/app/api/company/jobs/[id]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { updateJobSchema } from "@/features/jobs/lib/types";

  async function loadOwnedJob(id: string, companyId: string) {
    const job = await db.job.findUnique({ where: { id } });
    if (!job || job.companyId !== companyId) return null;
    return job;
  }

  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (session.role !== "COMPANY") {
      return NextResponse.json({ error: "Only company accounts can manage jobs" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await loadOwnedJob(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    try {
      const body = await request.json();
      const parsed = updateJobSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const job = await db.job.update({ where: { id }, data: parsed.data });
      logger.info("jobs", "Job updated", { jobId: id, companyId: session.userId });
      return NextResponse.json({ job });
    } catch (error) {
      logger.error("jobs", "Update job failed", { jobId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
    }
  }

  export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (session.role !== "COMPANY") {
      return NextResponse.json({ error: "Only company accounts can manage jobs" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await loadOwnedJob(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    await db.job.delete({ where: { id } });
    logger.info("jobs", "Job deleted", { jobId: id, companyId: session.userId });
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/company/jobs
  git commit -m "$(cat <<'EOF'
  Add company API routes to create, edit, and delete job postings

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Company `JobForm` component

**Files:**
- Create: `src/features/jobs/components/company/JobForm.tsx`

**Interfaces:**
- Consumes: `EMPLOYMENT_TYPES`, `EMPLOYMENT_TYPE_LABELS`, `LOCATION_TYPES`, `LOCATION_TYPE_LABELS`, `EmploymentType`, `LocationType` (Task 2); `SelectField` (Task 2); `TextField`, `TextAreaField`, `Button` (existing); `POST /api/company/jobs`, `PATCH /api/company/jobs/[id]` (Task 3).
- Produces: `JobForm(props: { mode: "create" } | { mode: "edit"; job: JobFormInitial })` and exported type `JobFormInitial = { id, title, description, requirements: string | null, employmentType: EmploymentType, hoursPerWeek: number | null, weeksPerYear: number | null, pay: string | null, location: string | null, locationType: LocationType }`. Task 5's edit page constructs and passes a `JobFormInitial`.

- [ ] **Step 1: Create `src/features/jobs/components/company/JobForm.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { Button } from "@/components/ui/Button";
  import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
  import {
    EMPLOYMENT_TYPES,
    EMPLOYMENT_TYPE_LABELS,
    LOCATION_TYPES,
    LOCATION_TYPE_LABELS,
    type EmploymentType,
    type LocationType,
  } from "../../lib/types";

  export type JobFormInitial = {
    id: string;
    title: string;
    description: string;
    requirements: string | null;
    employmentType: EmploymentType;
    hoursPerWeek: number | null;
    weeksPerYear: number | null;
    pay: string | null;
    location: string | null;
    locationType: LocationType;
  };

  type Props = { mode: "create" } | { mode: "edit"; job: JobFormInitial };

  export function JobForm(props: Props) {
    const router = useRouter();
    const initial = props.mode === "edit" ? props.job : null;

    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [requirements, setRequirements] = useState(initial?.requirements ?? "");
    const [employmentType, setEmploymentType] = useState<EmploymentType>(initial?.employmentType ?? "FULL_TIME");
    const [hoursPerWeek, setHoursPerWeek] = useState(initial?.hoursPerWeek?.toString() ?? "");
    const [weeksPerYear, setWeeksPerYear] = useState(initial?.weeksPerYear?.toString() ?? "");
    const [pay, setPay] = useState(initial?.pay ?? "");
    const [location, setLocation] = useState(initial?.location ?? "");
    const [locationType, setLocationType] = useState<LocationType>(initial?.locationType ?? "ON_SITE");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
      setSubmitting(true);
      setError(null);

      const payload = {
        title,
        description,
        requirements: requirements.trim() || undefined,
        employmentType,
        hoursPerWeek: hoursPerWeek.trim() ? Number(hoursPerWeek) : undefined,
        weeksPerYear: weeksPerYear.trim() ? Number(weeksPerYear) : undefined,
        pay: pay.trim() || undefined,
        location: location.trim() || undefined,
        locationType,
      };

      try {
        const url = props.mode === "create" ? "/api/company/jobs" : `/api/company/jobs/${props.job.id}`;
        const method = props.mode === "create" ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        router.push("/company/jobs");
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
        <TextField label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <TextAreaField
          label="Role description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <TextAreaField
          label="Requirements / qualifications (optional)"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Employment type"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_TYPE_LABELS[type] }))}
          />
          <SelectField
            label="Location type"
            value={locationType}
            onChange={(e) => setLocationType(e.target.value as LocationType)}
            options={LOCATION_TYPES.map((type) => ({ value: type, label: LOCATION_TYPE_LABELS[type] }))}
          />
          <TextField
            label="Hours per week (optional)"
            type="number"
            min={1}
            max={168}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
          />
          <TextField
            label="Weeks per year (optional)"
            type="number"
            min={1}
            max={52}
            value={weeksPerYear}
            onChange={(e) => setWeeksPerYear(e.target.value)}
          />
          <TextField
            label="Pay (optional)"
            placeholder="e.g. $20/hr or Unpaid"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
          />
          <TextField
            label="Location (optional)"
            placeholder="e.g. Austin, TX"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving…" : props.mode === "create" ? "Post job" : "Save changes"}
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/jobs/components/company/JobForm.tsx
  git commit -m "$(cat <<'EOF'
  Add JobForm component for creating and editing job postings

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: Company job pages (list / new / edit)

**Files:**
- Create: `src/features/jobs/components/company/JobActions.tsx`
- Modify: `src/app/(company)/company/jobs/page.tsx` (replace placeholder)
- Modify: `src/app/(company)/company/jobs/new/page.tsx` (replace placeholder)
- Create: `src/app/(company)/company/jobs/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `db.job` (Task 1), `JobForm`/`JobFormInitial` (Task 4), `EMPLOYMENT_TYPE_LABELS`, `EmploymentType`, `JobStatus` (Task 2), `requireCompany` (existing), `PATCH`/`DELETE /api/company/jobs/[id]` (Task 3).
- Produces: pages at `/company/jobs`, `/company/jobs/new`, `/company/jobs/[id]/edit`. `JobActions({ jobId, status })` component reused nowhere else.

- [ ] **Step 1: Create `src/features/jobs/components/company/JobActions.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";
  import type { JobStatus } from "../../lib/types";

  export function JobActions({ jobId, status }: { jobId: string; status: JobStatus }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    async function toggleStatus() {
      setBusy(true);
      try {
        await fetch(`/api/company/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: status === "OPEN" ? "CLOSED" : "OPEN" }),
        });
        router.refresh();
      } finally {
        setBusy(false);
      }
    }

    async function remove() {
      if (!confirm("Delete this posting? This also deletes its applications.")) return;
      setBusy(true);
      try {
        await fetch(`/api/company/jobs/${jobId}`, { method: "DELETE" });
        router.refresh();
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="flex items-center gap-2">
        <Link href={`/company/jobs/${jobId}/applicants`}>
          <Button variant="secondary">Applicants</Button>
        </Link>
        <Link href={`/company/jobs/${jobId}/edit`}>
          <Button variant="secondary">Edit</Button>
        </Link>
        <Button variant="secondary" onClick={toggleStatus} disabled={busy}>
          {status === "OPEN" ? "Close" : "Reopen"}
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy}>
          Delete
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Replace `src/app/(company)/company/jobs/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireCompany } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { Button } from "@/components/ui/Button";
  import { JobActions } from "@/features/jobs/components/company/JobActions";
  import { EMPLOYMENT_TYPE_LABELS, type EmploymentType, type JobStatus } from "@/features/jobs/lib/types";

  export default async function CompanyJobsPage() {
    const session = await requireCompany();

    const jobs = await db.job.findMany({
      where: { companyId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Job postings</h1>
          <Link href="/company/jobs/new">
            <Button>Post a job</Button>
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium text-slate-700">No job postings yet</p>
            <p className="mt-1 text-sm text-slate-500">
              When you create a job posting, it will appear here. Candidates on the platform can
              apply directly, and you can use AI to filter and shortlist resumes.
            </p>
            <Link href="/company/jobs/new" className="mt-4 inline-block">
              <Button variant="secondary">Create your first posting</Button>
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
                    <span className={job.status === "OPEN" ? "text-green-700" : "text-slate-500"}>
                      {job.status === "OPEN" ? "Open" : "Closed"}
                    </span>{" "}
                    · {job._count.applications} applicant{job._count.applications === 1 ? "" : "s"}
                  </p>
                </div>
                <JobActions jobId={job.id} status={job.status as JobStatus} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Replace `src/app/(company)/company/jobs/new/page.tsx`**

  ```tsx
  import { requireCompany } from "@/features/auth/lib/guard";
  import { JobForm } from "@/features/jobs/components/company/JobForm";

  export default async function NewJobPage() {
    await requireCompany();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Post a job</h1>
          <p className="mt-1 text-slate-600">
            Fill in the details below — it&rsquo;ll be visible to job seekers once posted.
          </p>
        </div>
        <JobForm mode="create" />
      </div>
    );
  }
  ```

- [ ] **Step 4: Create `src/app/(company)/company/jobs/[id]/edit/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireCompany } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { JobForm, type JobFormInitial } from "@/features/jobs/components/company/JobForm";
  import type { EmploymentType, LocationType } from "@/features/jobs/lib/types";

  export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireCompany();
    const { id } = await params;

    const job = await db.job.findUnique({ where: { id } });
    if (!job || job.companyId !== session.userId) notFound();

    const initial: JobFormInitial = {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      employmentType: job.employmentType as EmploymentType,
      hoursPerWeek: job.hoursPerWeek,
      weeksPerYear: job.weeksPerYear,
      pay: job.pay,
      location: job.location,
      locationType: job.locationType as LocationType,
    };

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit job posting</h1>
        </div>
        <JobForm mode="edit" job={initial} />
      </div>
    );
  }
  ```

- [ ] **Step 5: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/jobs/components/company/JobActions.tsx "src/app/(company)/company/jobs"
  git commit -m "$(cat <<'EOF'
  Wire up company job posting list, create, and edit pages

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Company applicants (API route + component + page)

**Files:**
- Create: `src/app/api/company/applications/[id]/route.ts`
- Create: `src/features/jobs/components/company/ApplicantsList.tsx`
- Create: `src/app/(company)/company/jobs/[id]/applicants/page.tsx`

**Interfaces:**
- Consumes: `db.application`, `db.job` (Task 1); `updateApplicationStatusSchema`, `APPLICATION_STATUSES`, `APPLICATION_STATUS_LABELS`, `ApplicationStatus` (Task 2); `getSession`, `requireCompany` (existing).
- Produces: `PATCH /api/company/applications/[id]` → `{ application }`. `ApplicantsList({ initialApplicants: ApplicantRow[] })` where `ApplicantRow = { id, applicantName: string | null, applicantEmail, note: string | null, status, createdAt, resumeTitle, resumeHtml }`. Page at `/company/jobs/[id]/applicants`.

  **Deviation from the spec:** the spec said applicant resumes would reuse "the existing resume detail/export route" — that route (`/resume-builder/edit/[id]`) is customer-only (the `(customer)` layout redirects COMPANY-role sessions away before the page's own ownership check even runs) and is editable. Instead, this task renders a **read-only** inline preview of `resume.htmlContent` directly inside `ApplicantsList`, using the same `dangerouslySetInnerHTML` pattern `ResumeEditor.tsx` already uses — just without `contentEditable`. No new route is needed; the company's ownership of the parent job is already verified by the page below before any resume HTML is sent to the client.

- [ ] **Step 1: Create `src/app/api/company/applications/[id]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { updateApplicationStatusSchema } from "@/features/jobs/lib/types";

  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (session.role !== "COMPANY") {
      return NextResponse.json({ error: "Only company accounts can manage applications" }, { status: 403 });
    }

    const { id } = await params;
    const application = await db.application.findUnique({ where: { id }, include: { job: true } });
    if (!application || application.job.companyId !== session.userId) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    try {
      const body = await request.json();
      const parsed = updateApplicationStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const updated = await db.application.update({ where: { id }, data: { status: parsed.data.status } });
      logger.info("jobs", "Application status updated", { applicationId: id, status: parsed.data.status });
      return NextResponse.json({ application: updated });
    } catch (error) {
      logger.error("jobs", "Update application failed", { applicationId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't save that change. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create `src/features/jobs/components/company/ApplicantsList.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { SelectField } from "@/components/ui/Field";
  import { Button } from "@/components/ui/Button";
  import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "../../lib/types";

  export type ApplicantRow = {
    id: string;
    applicantName: string | null;
    applicantEmail: string;
    note: string | null;
    status: ApplicationStatus;
    createdAt: string;
    resumeTitle: string;
    resumeHtml: string;
  };

  export function ApplicantsList({ initialApplicants }: { initialApplicants: ApplicantRow[] }) {
    const [applicants, setApplicants] = useState(initialApplicants);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    async function updateStatus(id: string, status: ApplicationStatus) {
      setSavingId(id);
      const previous = applicants;
      setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      try {
        const res = await fetch(`/api/company/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) setApplicants(previous);
      } catch {
        setApplicants(previous);
      } finally {
        setSavingId(null);
      }
    }

    if (applicants.length === 0) {
      return <p className="text-sm text-slate-500">No applicants yet.</p>;
    }

    return (
      <ul className="flex flex-col gap-3">
        {applicants.map((applicant) => (
          <li key={applicant.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{applicant.applicantName ?? applicant.applicantEmail}</p>
                <p className="text-xs text-slate-500">
                  {applicant.applicantEmail} · applied {new Date(applicant.createdAt).toLocaleDateString()}
                </p>
                {applicant.note && <p className="mt-1 text-sm text-slate-700">&ldquo;{applicant.note}&rdquo;</p>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-40">
                  <SelectField
                    label="Status"
                    value={applicant.status}
                    disabled={savingId === applicant.id}
                    onChange={(e) => updateStatus(applicant.id, e.target.value as ApplicationStatus)}
                    options={APPLICATION_STATUSES.map((status) => ({
                      value: status,
                      label: APPLICATION_STATUS_LABELS[status],
                    }))}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setExpandedId((current) => (current === applicant.id ? null : applicant.id))}
                >
                  {expandedId === applicant.id ? "Hide resume" : `View resume: ${applicant.resumeTitle}`}
                </Button>
              </div>
            </div>

            {expandedId === applicant.id && (
              <div
                dangerouslySetInnerHTML={{ __html: applicant.resumeHtml }}
                className="mt-4 rounded-md border border-slate-200 p-8"
              />
            )}
          </li>
        ))}
      </ul>
    );
  }
  ```

- [ ] **Step 3: Create `src/app/(company)/company/jobs/[id]/applicants/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireCompany } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { ApplicantsList, type ApplicantRow } from "@/features/jobs/components/company/ApplicantsList";
  import type { ApplicationStatus } from "@/features/jobs/lib/types";

  export default async function JobApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireCompany();
    const { id } = await params;

    const job = await db.job.findUnique({ where: { id } });
    if (!job || job.companyId !== session.userId) notFound();

    const applications = await db.application.findMany({
      where: { jobId: id },
      orderBy: { createdAt: "desc" },
      include: { user: true, resume: true },
    });

    const applicants: ApplicantRow[] = applications.map((app) => ({
      id: app.id,
      applicantName: app.user.name,
      applicantEmail: app.user.email,
      note: app.note,
      status: app.status as ApplicationStatus,
      createdAt: app.createdAt.toISOString(),
      resumeTitle: app.resume.title,
      resumeHtml: app.resume.htmlContent,
    }));

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applicants — {job.title}</h1>
        </div>
        <ApplicantsList initialApplicants={applicants} />
      </div>
    );
  }
  ```

- [ ] **Step 4: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/company/applications src/features/jobs/components/company/ApplicantsList.tsx "src/app/(company)/company/jobs/[id]/applicants"
  git commit -m "$(cat <<'EOF'
  Add company applicants view with status updates and resume preview

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Company dashboard stats wiring

**Files:**
- Modify: `src/app/(company)/company/page.tsx`

**Interfaces:**
- Consumes: `db.job`, `db.application` (Task 1).
- Produces: nothing consumed by later tasks — a leaf change.

- [ ] **Step 1: Replace `src/app/(company)/company/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireCompany } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { Button } from "@/components/ui/Button";

  export default async function CompanyDashboardPage() {
    const session = await requireCompany();

    const profile = await db.profile.findUnique({
      where: { id: session.userId },
      select: { name: true, profileJson: true },
    });

    const profileData = profile?.profileJson
      ? (JSON.parse(profile.profileJson) as Record<string, string>)
      : null;

    const companyName = profileData?.companyName ?? profile?.name ?? "Your Company";

    const [activeJobs, totalApplicants, shortlisted, totalJobs] = await Promise.all([
      db.job.count({ where: { companyId: session.userId, status: "OPEN" } }),
      db.application.count({ where: { job: { companyId: session.userId } } }),
      db.application.count({ where: { job: { companyId: session.userId }, status: "SHORTLISTED" } }),
      db.job.count({ where: { companyId: session.userId } }),
    ]);

    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {companyName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your job postings and review candidate applications from here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-3xl font-bold text-slate-900">{activeJobs}</p>
            <p className="mt-1 text-sm text-slate-500">Active job postings</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-3xl font-bold text-slate-900">{totalApplicants}</p>
            <p className="mt-1 text-sm text-slate-500">Total applicants</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-3xl font-bold text-slate-900">{shortlisted}</p>
            <p className="mt-1 text-sm text-slate-500">Shortlisted candidates</p>
          </div>
        </div>

        {totalJobs === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-medium text-slate-700">No job postings yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first job posting to start receiving applications from candidates on Focal.
            </p>
            <Link href="/company/jobs/new" className="mt-4 inline-block">
              <Button>Post a job</Button>
            </Link>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "src/app/(company)/company/page.tsx"
  git commit -m "$(cat <<'EOF'
  Wire company dashboard stat tiles to real job/application counts

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: Customer apply API route

**Files:**
- Create: `src/app/api/jobs/[id]/apply/route.ts`

**Interfaces:**
- Consumes: `db.job`, `db.resume`, `db.application` (Task 1); `applySchema` (Task 2); `getSession` (existing).
- Produces: `POST /api/jobs/[id]/apply` → `{ id, status }` on success (201-equivalent 200), `{ error }` with 401/404/400/409/500 on failure. Task 10's `ApplyButton` calls this.

- [ ] **Step 1: Create `src/app/api/jobs/[id]/apply/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { applySchema } from "@/features/jobs/lib/types";

  export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id: jobId } = await params;
    const job = await db.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "OPEN") {
      return NextResponse.json({ error: "This job posting isn't open for applications" }, { status: 404 });
    }

    try {
      const body = await request.json();
      const parsed = applySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const resume = await db.resume.findUnique({ where: { id: parsed.data.resumeId } });
      if (!resume || resume.userId !== session.userId) {
        return NextResponse.json({ error: "Choose one of your own resumes" }, { status: 400 });
      }

      const existing = await db.application.findUnique({
        where: { jobId_userId: { jobId, userId: session.userId } },
      });
      if (existing) {
        return NextResponse.json({ error: "You've already applied to this job" }, { status: 409 });
      }

      const application = await db.application.create({
        data: {
          jobId,
          userId: session.userId,
          resumeId: parsed.data.resumeId,
          note: parsed.data.note,
        },
      });

      logger.info("jobs", "Application submitted", {
        applicationId: application.id,
        jobId,
        userId: session.userId,
      });
      return NextResponse.json({ id: application.id, status: application.status });
    } catch (error) {
      logger.error("jobs", "Apply failed", { jobId, error: String(error) });
      return NextResponse.json({ error: "Couldn't submit your application. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/jobs
  git commit -m "$(cat <<'EOF'
  Add customer apply-to-job API route

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Customer jobs listing (page + filters)

**Files:**
- Create: `src/features/jobs/components/customer/JobFilters.tsx`
- Create: `src/app/(customer)/jobs/page.tsx`

**Interfaces:**
- Consumes: `db.job` (Task 1); `EMPLOYMENT_TYPES`, `EMPLOYMENT_TYPE_LABELS`, `LOCATION_TYPE_LABELS`, `EmploymentType`, `LocationType` (Task 2); `SelectField`, `TextField` (existing/Task 2); `requireUser` (existing).
- Produces: page at `/jobs`. `JobFilters()` reused nowhere else.

- [ ] **Step 1: Create `src/features/jobs/components/customer/JobFilters.tsx`**

  ```tsx
  "use client";

  import { useRef } from "react";
  import { useRouter, useSearchParams, usePathname } from "next/navigation";
  import { SelectField, TextField } from "@/components/ui/Field";
  import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from "../../lib/types";

  export function JobFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const type = searchParams.get("type") ?? "";
    const q = searchParams.get("q") ?? "";

    function updateParam(key: string, value: string) {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    }

    function handleSearchChange(value: string) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateParam("q", value), 300);
    }

    return (
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <TextField
          label="Search"
          placeholder="Search job titles…"
          defaultValue={q}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <SelectField
          label="Employment type"
          value={type}
          onChange={(e) => updateParam("type", e.target.value)}
          options={[
            { value: "", label: "All types" },
            ...EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABELS[t] })),
          ]}
        />
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/jobs/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { JobFilters } from "@/features/jobs/components/customer/JobFilters";
  import {
    EMPLOYMENT_TYPE_LABELS,
    LOCATION_TYPE_LABELS,
    type EmploymentType,
    type LocationType,
  } from "@/features/jobs/lib/types";

  export default async function JobsPage({
    searchParams,
  }: {
    searchParams: Promise<{ type?: string; q?: string }>;
  }) {
    await requireUser();
    const { type, q } = await searchParams;

    const jobs = await db.job.findMany({
      where: {
        status: "OPEN",
        ...(type ? { employmentType: type } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true, profileJson: true } } },
    });

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job opportunities</h1>
          <p className="mt-1 text-slate-600">Browse open roles and internships posted by companies on Focal.</p>
        </div>

        <JobFilters />

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">No open postings match your filters right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {jobs.map((job) => {
              const companyData = job.company.profileJson
                ? (JSON.parse(job.company.profileJson) as Record<string, string>)
                : null;
              const companyName = companyData?.companyName ?? job.company.name ?? "A company on Focal";
              return (
                <li key={job.id} className="px-5 py-4">
                  <Link href={`/jobs/${job.id}`} className="block hover:opacity-80">
                    <p className="font-medium text-slate-900">{job.title}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {companyName} · {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
                      {LOCATION_TYPE_LABELS[job.locationType as LocationType]}
                      {job.pay ? ` · ${job.pay}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/jobs/components/customer/JobFilters.tsx "src/app/(customer)/jobs/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add customer job listing page with filters

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 10: Customer job detail + apply UI

**Files:**
- Create: `src/features/jobs/components/customer/ApplyButton.tsx`
- Create: `src/app/(customer)/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `db.job`, `db.resume`, `db.application` (Task 1); `EMPLOYMENT_TYPE_LABELS`, `LOCATION_TYPE_LABELS`, `APPLICATION_STATUS_LABELS`, `EmploymentType`, `LocationType`, `ApplicationStatus` (Task 2); `POST /api/jobs/[id]/apply` (Task 8); `requireUser` (existing).
- Produces: page at `/jobs/[id]`. `ApplyButton({ jobId, resumes, initialStatus })` reused nowhere else.

- [ ] **Step 1: Create `src/features/jobs/components/customer/ApplyButton.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";
  import { SelectField, TextAreaField } from "@/components/ui/Field";
  import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "../../lib/types";

  export function ApplyButton({
    jobId,
    resumes,
    initialStatus,
  }: {
    jobId: string;
    resumes: { id: string; title: string }[];
    initialStatus: ApplicationStatus | null;
  }) {
    const [status, setStatus] = useState<ApplicationStatus | null>(initialStatus);
    const [open, setOpen] = useState(false);
    const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (status) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          You&rsquo;ve applied to this job. Status: {APPLICATION_STATUS_LABELS[status]}
        </div>
      );
    }

    if (resumes.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          You need a resume before applying.{" "}
          <Link href="/resume-builder" className="text-indigo-700 hover:underline">
            Build one now
          </Link>
          .
        </div>
      );
    }

    if (!open) {
      return <Button onClick={() => setOpen(true)}>Apply</Button>;
    }

    async function submit() {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId, note: note.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        setStatus(data.status as ApplicationStatus);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <SelectField
          label="Resume to send"
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          options={resumes.map((r) => ({ value: r.id, label: r.title }))}
        />
        <TextAreaField
          label="Note (optional)"
          placeholder="Anything you'd like to add…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit application"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/jobs/[id]/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { ApplyButton } from "@/features/jobs/components/customer/ApplyButton";
  import {
    EMPLOYMENT_TYPE_LABELS,
    LOCATION_TYPE_LABELS,
    type EmploymentType,
    type LocationType,
    type ApplicationStatus,
  } from "@/features/jobs/lib/types";

  export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser();
    const { id } = await params;

    const job = await db.job.findUnique({
      where: { id },
      include: { company: { select: { name: true, profileJson: true } } },
    });
    if (!job) notFound();

    const [resumes, existingApplication] = await Promise.all([
      db.resume.findMany({
        where: { userId: session.userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.application.findUnique({ where: { jobId_userId: { jobId: id, userId: session.userId } } }),
    ]);

    const companyData = job.company.profileJson
      ? (JSON.parse(job.company.profileJson) as Record<string, string>)
      : null;
    const companyName = companyData?.companyName ?? job.company.name ?? "A company on Focal";

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
          <p className="mt-1 text-slate-600">{companyName}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
            {LOCATION_TYPE_LABELS[job.locationType as LocationType]}
            {job.location ? ` · ${job.location}` : ""}
            {job.hoursPerWeek ? ` · ${job.hoursPerWeek} hrs/week` : ""}
            {job.weeksPerYear ? ` · ${job.weeksPerYear} weeks/year` : ""}
            {job.pay ? ` · ${job.pay}` : ""}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 font-semibold text-slate-900">About this role</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
        </div>

        {job.requirements && (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-2 font-semibold text-slate-900">Requirements</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{job.requirements}</p>
          </div>
        )}

        {job.status === "OPEN" ? (
          <ApplyButton
            jobId={job.id}
            resumes={resumes}
            initialStatus={existingApplication ? (existingApplication.status as ApplicationStatus) : null}
          />
        ) : (
          <p className="text-sm text-slate-500">This posting is closed and no longer accepting applications.</p>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/jobs/components/customer/ApplyButton.tsx "src/app/(customer)/jobs/[id]/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add customer job detail page with apply flow

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 11: Customer "My Applications" page

**Files:**
- Create: `src/app/(customer)/jobs/applications/page.tsx`

**Interfaces:**
- Consumes: `db.application` (Task 1); `APPLICATION_STATUS_LABELS`, `ApplicationStatus` (Task 2); `requireUser` (existing).
- Produces: page at `/jobs/applications`.

- [ ] **Step 1: Create `src/app/(customer)/jobs/applications/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/features/jobs/lib/types";

  export default async function MyApplicationsPage() {
    const session = await requireUser();

    const applications = await db.application.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: { job: { include: { company: { select: { name: true, profileJson: true } } } } },
    });

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My applications</h1>
          <p className="mt-1 text-slate-600">Jobs you&rsquo;ve applied to and their current status.</p>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">You haven&rsquo;t applied to any jobs yet.</p>
            <Link href="/jobs" className="mt-3 inline-block text-sm text-indigo-700 hover:underline">
              Browse open jobs
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {applications.map((application) => {
              const companyData = application.job.company.profileJson
                ? (JSON.parse(application.job.company.profileJson) as Record<string, string>)
                : null;
              const companyName = companyData?.companyName ?? application.job.company.name ?? "A company on Focal";
              return (
                <li key={application.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <Link href={`/jobs/${application.job.id}`} className="font-medium text-slate-900 hover:underline">
                      {application.job.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {companyName} · applied {application.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "src/app/(customer)/jobs/applications"
  git commit -m "$(cat <<'EOF'
  Add customer My Applications page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 12: Customer nav links

**Files:**
- Modify: `src/components/CustomerNav.tsx`

**Interfaces:**
- Consumes: nothing new (just adds `<Link>`s to routes from Tasks 9 and 11).
- Produces: nothing consumed elsewhere — a leaf change.

- [ ] **Step 1: Replace `src/components/CustomerNav.tsx`**

  ```tsx
  "use client";

  import Link from "next/link";
  import { useRouter } from "next/navigation";
  import { createClient } from "@/lib/supabase/client";
  import { Button } from "@/components/ui/Button";

  export function CustomerNav() {
    const router = useRouter();

    async function logout() {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    }

    return (
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-indigo-700">
              Focal
            </Link>
            <Link href="/resume-builder" className="text-sm text-slate-600 hover:text-slate-900">
              New resume
            </Link>
            <Link href="/resume-analyzer" className="text-sm text-slate-600 hover:text-slate-900">
              Analyze resume
            </Link>
            <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900">
              Jobs
            </Link>
            <Link href="/jobs/applications" className="text-sm text-slate-600 hover:text-slate-900">
              My applications
            </Link>
          </div>
          <Button variant="ghost" onClick={logout}>
            Log out
          </Button>
        </div>
      </nav>
    );
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/CustomerNav.tsx
  git commit -m "$(cat <<'EOF'
  Add Jobs and My Applications links to customer nav

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 13: Final verification

**Files:** none (verification only).

**Interfaces:** none — this task consumes everything built in Tasks 1–12 as a whole.

- [ ] **Step 1: Full lint**

  Run: `npm run lint`
  Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 2: Full production build**

  Run: `rm -rf .next && npm run build`

  **Only run this while no `npm run dev` process is currently running** — deleting `.next` out from under a live dev server corrupts its cache (this happened during the resume-analyzer feature). Check first with `ps aux | grep "next dev" | grep -v grep`; if one is running, ask the person running it to stop it first, or skip the `rm -rf .next` and just run `npm run build`.

  Expected: `✓ Compiled successfully`, and the route table includes `/company/jobs`, `/company/jobs/new`, `/company/jobs/[id]/edit`, `/company/jobs/[id]/applicants`, `/jobs`, `/jobs/[id]`, `/jobs/applications`, `/api/company/jobs`, `/api/company/jobs/[id]`, `/api/company/applications/[id]`, `/api/jobs/[id]/apply`.

- [ ] **Step 3: Read-only DB sanity check**

  Confirm no orphaned state and that both new tables are reachable through every relation used above:

  ```bash
  cat > .tmp-verify-final.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const jobCount = await db.job.count();
    const appCount = await db.application.count();
    console.log("jobs:", jobCount, "applications:", appCount);
    // Exercises every relation path used by the pages/routes above.
    await db.job.findMany({ where: { status: "OPEN" }, include: { company: true } });
    await db.application.findMany({ include: { job: true, user: true, resume: true } });
    console.log("All relation queries succeeded.");
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-final.ts
  rm -f .tmp-verify-final.ts
  ```
  Expected: counts print (likely `0 0` on a fresh migration) and "All relation queries succeeded." with no Prisma errors.

- [ ] **Step 4: Manual browser smoke test**

  This requires one COMPANY-role account and one CUSTOMER-role account signed in (in two browser sessions/profiles) — do not create new accounts to do this (that means entering a password, which is off-limits for an agent to do on the person's behalf); ask the project owner to run this checklist themselves, or run it yourself only if you already have two such accounts available:

  1. As the company: go to `/company/jobs/new`, submit a posting (try leaving Hours/week and Weeks/year blank to confirm the optional-number handling from Task 2's note works). Confirm redirect to `/company/jobs` and the new posting is listed as "Open".
  2. As the customer: go to `/jobs`, confirm the posting appears; filter by its employment type and by a keyword from its title, confirm it still appears; open it at `/jobs/[id]`.
  3. Click "Apply", pick a resume, add a note, submit. Confirm the button becomes an "Applied" state. Reload the page — confirm it's still "Applied" (not a re-apply prompt).
  4. Go to `/jobs/applications` as the customer — confirm the application is listed with status "Submitted".
  5. As the company: go to `/company/jobs`, confirm the applicant count is now 1. Click "Applicants", confirm the applicant's name/email/note show up, click "View resume" and confirm it renders (read-only — no editable content).
  6. Change the applicant's status to "Shortlisted". Reload — confirm it persisted.
  7. As the customer: reload `/jobs/applications` — confirm the status now shows "Shortlisted".
  8. As the company: go back to `/company/jobs`, click "Close" on the posting. As the customer, reload `/jobs` — confirm the posting no longer appears there, but it's still visible at `/jobs/applications` and at its direct `/jobs/[id]` URL (showing "closed" messaging, no Apply button).
  9. As the company: click "Edit" on the posting, change the title, save — confirm the new title shows on `/company/jobs` and (if reopened) on `/jobs`.
  10. As the company: delete the posting — confirm it disappears from `/company/jobs`.

## Self-Review Notes

- **Spec coverage:** every section of the design doc maps to a task — data model → Task 1; company create/edit/list/delete → Tasks 3–5; company applicants+status → Task 6; company dashboard stats → Task 7; customer apply → Task 8; customer browse+filter → Task 9; customer detail+apply UI → Task 10; My Applications → Task 11; nav → Task 12. The one deviation (resume viewing mechanism in Task 6) is called out explicitly where it happens, with the reasoning.
- **Placeholder scan:** no TBD/TODO; every step has literal file contents, not descriptions of them.
- **Type consistency:** `ApplicationStatus`/`EmploymentType`/`LocationType`/`JobStatus` (Task 2) are the single source of truth and are imported (never redefined) everywhere else. `db.application.findUnique({ where: { jobId_userId: ... } })` (Tasks 8, 10) matches the `@@unique([jobId, userId])` compound index defined in Task 1 exactly (Prisma's default compound-key name is the field names joined with `_`, in declaration order). `JobFormInitial` (Task 4) matches exactly what Task 5's edit page constructs. `ApplicantRow` (Task 6) matches exactly what the applicants page constructs.
