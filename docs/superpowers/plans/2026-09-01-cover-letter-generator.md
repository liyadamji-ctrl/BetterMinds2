# Cover Letter Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer generate a customized cover letter (from a resume + a platform or hand-described job), review/edit it, regenerate/copy/download it, keep a history, and use 5 static email templates alongside it.

**Architecture:** One new `CoverLetter` table. A single shared Groq-calling function backs both initial generation and regeneration. Pages follow the resume builder's proven wizard → editor split (a cover letter is an editable document, not a one-shot result) — same `contentEditable` pattern as `ResumeEditor`, same DOCX-export-via-the-`docx`-package pattern as the resume exporter.

**Tech Stack:** Next.js 14 App Router, Prisma 7 over Supabase Postgres, Groq (existing `src/lib/groq.ts`), the `docx` npm package (existing dependency), zod, Tailwind.

**Spec:** [docs/superpowers/specs/2026-09-01-cover-letter-generator-design.md](../specs/2026-09-01-cover-letter-generator-design.md)

## Global Constraints

- No automated test framework exists in this repo. Per-task verification is `npx tsc --noEmit` + `npm run lint`; the final task runs `npm run build` (or `npx tsc --noEmit` only, if a dev server is live in the same checkout — check `ps aux | grep "next dev"` and confirm its cwd via `lsof -p <pid> | grep cwd` before deciding; `rm -rf .next` against a live dev server's own directory has corrupted that server's cache before in this project's history).
- Every new Prisma field maps to its snake_case column via `@map(...)`, matching every existing model exactly — a missing `@map` was a real bug caught in this project's history.
- The new SQL file is `supabase/sql/009_cover_letters.sql` (008 is currently the highest-numbered file). Apply it directly against `DATABASE_URL` the same way prior SQL files in this project were applied: a throwaway Node/tsx script using `db.$executeRawUnsafe` per statement (stripping `--` comment lines before splitting on `;`), run it, verify, delete it.
- API routes MUST use `getSession()` from `src/features/auth/lib/guard.ts` + manual ownership/role checks, never `requireCompany()`/`requireUser()` inside a Route Handler (those call Next's `redirect()`, which only works in Server Components/Pages).
- Cover letters are private to the customer who wrote them — no company-facing visibility anywhere in this plan, and no route in this plan uses `requireCompany()`/company-role checks.
- A cover letter's `htmlContent` is a flat sequence of `<p>` tags with no styling, no headers — this is both what the generation prompt is instructed to produce and what the DOCX exporter assumes when splitting on `<p>` tags.

---

### Task 1: Data model — Prisma schema + Supabase migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `supabase/sql/009_cover_letters.sql`

**Interfaces:**
- Produces: Prisma model `CoverLetter` (fields: `id, userId, resumeId, jobId, companyName, jobTitle, jobDescription, htmlContent, createdAt, updatedAt`) and relation fields `Profile.coverLetters`, `Resume.coverLetters`, `Job.coverLetters`. Every later task's Prisma calls depend on these exact field names.

- [ ] **Step 1: Add the `CoverLetter` model to `prisma/schema.prisma`**

  Insert this new section right before the `// --- Session recording (admin) --------------------------------------------` comment (i.e. immediately after the `Application` model):

  ```prisma
  // --- Cover letters (Groq) ---------------------------------------------

  /// A generated cover letter, tied to one of the customer's own resumes
  /// and either a job posted on this platform or a hand-described external
  /// one. See src/features/cover-letters/.
  model CoverLetter {
    id     String  @id @default(cuid())
    userId String  @db.Uuid @map("user_id")
    user   Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

    resumeId String @map("resume_id")
    resume   Resume @relation(fields: [resumeId], references: [id], onDelete: Cascade)

    /// Set when generated for a job posted on this platform; null for a
    /// hand-described external job. onDelete: SetNull — deleting the
    /// platform job must not delete the customer's saved letter.
    jobId String? @map("job_id")
    job   Job?    @relation(fields: [jobId], references: [id], onDelete: SetNull)

    /// Always populated — copied from the platform Job at generation time,
    /// or typed in directly for an external job. Independent of jobId so a
    /// saved letter keeps correct context even if the Job row changes later.
    companyName    String  @map("company_name")
    jobTitle       String  @map("job_title")
    jobDescription String? @map("job_description")

    /// Editable HTML content of the letter — same role as Resume.htmlContent.
    /// Always a flat sequence of <p> tags (see the generation prompt in
    /// Task 2) — no headers, no styling.
    htmlContent String @map("html_content")

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@index([userId])
    @@map("cover_letters")
  }
  ```

- [ ] **Step 2: Add relation fields to `Profile`, `Resume`, and `Job`**

  In `Profile`, change:
  ```prisma
    resumes           Resume[]
    resumeAnalyses    ResumeAnalysis[]
    jobsPosted        Job[]              @relation("CompanyJobs")
    applications      Application[]      @relation("UserApplications")
    consent           Consent?
    sessionRecordings SessionRecording[]
  ```
  to:
  ```prisma
    resumes           Resume[]
    resumeAnalyses    ResumeAnalysis[]
    jobsPosted        Job[]              @relation("CompanyJobs")
    applications      Application[]      @relation("UserApplications")
    coverLetters      CoverLetter[]
    consent           Consent?
    sessionRecordings SessionRecording[]
  ```

  In `Resume`, change:
  ```prisma
    applications Application[]

    format String // matches an id in src/features/resume-builder/formats/*.ts
  ```
  to:
  ```prisma
    applications Application[]
    coverLetters CoverLetter[]

    format String // matches an id in src/features/resume-builder/formats/*.ts
  ```

  In `Job`, change:
  ```prisma
    applications Application[]

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@index([companyId])
    @@index([status])
    @@map("jobs")
  ```
  to:
  ```prisma
    applications Application[]
    coverLetters CoverLetter[]

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@index([companyId])
    @@index([status])
    @@map("jobs")
  ```

- [ ] **Step 3: Regenerate the Prisma client**

  Run: `npx prisma generate`
  Expected: `✔ Generated Prisma Client ... to ./node_modules/@prisma/client`

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 5: Create `supabase/sql/009_cover_letters.sql`**

  ```sql
  -- Generated cover letters. Tied to one of the customer's own resumes and
  -- either a job posted on this platform or a hand-described external one.
  -- See src/features/cover-letters/.

  create table public.cover_letters (
    id text primary key default gen_random_uuid()::text,
    user_id uuid not null references public.profiles (id) on delete cascade,
    resume_id text not null references public.resumes (id) on delete cascade,
    job_id text references public.jobs (id) on delete set null,
    company_name text not null,
    job_title text not null,
    job_description text,
    html_content text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index cover_letters_user_id_idx on public.cover_letters (user_id);

  create trigger cover_letters_set_updated_at
    before update on public.cover_letters
    for each row execute function public.set_updated_at();

  -- RLS: same story as every other *.sql file in supabase/sql/ — the app's
  -- own server-side checks are what actually protect this table day to
  -- day, since Prisma connects as `postgres` and bypasses RLS. This is the
  -- safety net for direct browser-side Supabase-client access.
  alter table public.cover_letters enable row level security;

  create policy "cover_letters: owner full access" on public.cover_letters
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ```

- [ ] **Step 6: Apply the migration to the real database**

  ```bash
  cat > .tmp-apply-009.ts << 'EOF'
  import "dotenv/config";
  import fs from "node:fs";
  import { db } from "./src/lib/db";

  async function main() {
    const raw = fs.readFileSync("supabase/sql/009_cover_letters.sql", "utf8");
    const sql = raw
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      await db.$executeRawUnsafe(statement);
    }
    console.log(`Applied ${statements.length} statements.`);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-apply-009.ts
  rm -f .tmp-apply-009.ts
  ```
  Expected: `Applied 4 statements.`

- [ ] **Step 7: Verify the table and columns match the schema**

  ```bash
  cat > .tmp-verify-009.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const cols = await db.$queryRawUnsafe(`select column_name from information_schema.columns where table_name = 'cover_letters' order by ordinal_position`);
    console.log("cover_letters columns:", cols);
    const count = await db.coverLetter.count();
    console.log("db.coverLetter.count() via Prisma:", count);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-009.ts
  rm -f .tmp-verify-009.ts
  ```
  Expected: all 10 columns print in snake_case (`id, user_id, resume_id, job_id, company_name, job_title, job_description, html_content, created_at, updated_at`), and `db.coverLetter.count()` returns `0` with no Prisma error — confirming every `@map` is correct.

- [ ] **Step 8: Commit**

  ```bash
  git add prisma/schema.prisma supabase/sql/009_cover_letters.sql
  git commit -m "$(cat <<'EOF'
  Add CoverLetter data model for the cover letter generator feature

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Shared libraries — Groq generation + DOCX export

**Files:**
- Create: `src/features/cover-letters/lib/generate.ts`
- Create: `src/features/cover-letters/lib/exportDocx.ts`

**Interfaces:**
- Consumes: `groqChat` from `src/lib/groq.ts` (existing), `ResumeAnswers` type from `src/features/resume-builder/formats/types.ts` (existing).
- Produces: `generateCoverLetterHtml(answers: ResumeAnswers, job: JobContext): Promise<string>` where `JobContext = { companyName: string; jobTitle: string; jobDescription: string | null; notes: string | null }` — returns the letter's HTML (never saves anything). `buildCoverLetterDocx(htmlContent: string, title: string): Promise<Buffer>`. Task 3's create/regenerate routes call `generateCoverLetterHtml`; Task 4's export route calls `buildCoverLetterDocx`.

- [ ] **Step 1: Create `src/features/cover-letters/lib/generate.ts`**

  ```typescript
  import "server-only";
  import { z } from "zod";
  import { groqChat } from "@/lib/groq";
  import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

  function str(answers: ResumeAnswers, section: string, field: string): string {
    const value = answers[section];
    if (!value || Array.isArray(value)) return "";
    return value[field] ?? "";
  }

  function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
    const value = answers[section];
    return Array.isArray(value) ? value : [];
  }

  const generatedLetterSchema = z.object({
    html: z.string().min(1),
  });

  export type JobContext = {
    companyName: string;
    jobTitle: string;
    jobDescription: string | null;
    notes: string | null;
  };

  const SYSTEM_PROMPT = `You are an expert career coach who writes specific, professional cover letters — never generic filler. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "html": "<p>...</p><p>...</p>..."
  }

  Rules:
  - "html" is the full cover letter body as a sequence of <p> tags — no headers, no styling, no markdown, no salutation placeholders like "[Hiring Manager]" unless you have no better option.
  - Reference specific details from both the resume and the job description — skills, projects, requirements — rather than vague statements like "I am a hard worker."
  - 3-5 short paragraphs: an opening that names the role and company, one or two body paragraphs connecting the candidate's actual experience/skills to the job's actual requirements, and a closing call to action.
  - Do not invent experience, employers, or skills that aren't in the resume.`;

  /**
   * Shared by both the initial "Generate" (Task 3's create route) and later
   * "Regenerate" (Task 3's regenerate route) so the prompt logic lives in
   * exactly one place. Never saves anything — the caller decides whether
   * to create or update a CoverLetter row.
   */
  export async function generateCoverLetterHtml(answers: ResumeAnswers, job: JobContext): Promise<string> {
    const name = str(answers, "personal", "fullName");
    const summary = str(answers, "summary", "summary");
    const skills = str(answers, "skills", "skills");

    const experienceText = items(answers, "experience")
      .map((item) => `- ${item.role ?? ""} at ${item.company ?? ""} (${item.dates ?? ""}): ${item.description ?? ""}`)
      .join("\n");

    const educationText = items(answers, "education")
      .map((item) => `- ${item.school ?? ""}${item.degree ? ", " + item.degree : ""} (${item.dates ?? ""})`)
      .join("\n");

    const userPrompt = [
      `CANDIDATE NAME: ${name || "the candidate"}`,
      summary ? `CANDIDATE SUMMARY: ${summary}` : "",
      experienceText ? `EXPERIENCE:\n${experienceText}` : "",
      educationText ? `EDUCATION:\n${educationText}` : "",
      skills ? `SKILLS: ${skills}` : "",
      `JOB TITLE: ${job.jobTitle}`,
      `COMPANY: ${job.companyName}`,
      job.jobDescription ? `JOB DESCRIPTION:\n${job.jobDescription}` : "",
      job.notes ? `ACCOMPLISHMENTS/NOTES TO EMPHASIZE:\n${job.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await groqChat({ system: SYSTEM_PROMPT, user: userPrompt });

    let resultJson: unknown;
    try {
      resultJson = JSON.parse(raw);
    } catch {
      throw new Error("Groq returned non-JSON output");
    }

    const result = generatedLetterSchema.parse(resultJson);
    return result.html;
  }
  ```

  Note: `JobContext.notes` is only ever populated on initial generation (from the `/cover-letters/new` form) — the `CoverLetter` table has no `notes` column (see Task 1), so regeneration always passes `notes: null`. This is deliberate: the accomplishments-to-emphasize field is a one-time input to the first draft, not part of the letter's persisted identity.

- [ ] **Step 2: Create `src/features/cover-letters/lib/exportDocx.ts`**

  ```typescript
  import { Document, Packer, Paragraph } from "docx";

  /**
   * A cover letter's htmlContent is always a flat sequence of <p> tags (see
   * generate.ts's prompt) — no nested sections like a resume — so this just
   * splits on </p> and strips any remaining tags into plain-text docx
   * Paragraphs. Tag-stripping (not just splitting) also makes this safe
   * against whatever markup a user's manual contentEditable edits produce.
   */
  export async function buildCoverLetterDocx(htmlContent: string, title: string): Promise<Buffer> {
    const paragraphTexts = htmlContent
      .split(/<\/p>/i)
      .map((chunk) => chunk.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean);

    const children =
      paragraphTexts.length > 0
        ? paragraphTexts.map((text) => new Paragraph({ text, spacing: { after: 200 } }))
        : [new Paragraph({ text: title })];

    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc);
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/cover-letters/lib
  git commit -m "$(cat <<'EOF'
  Add shared cover letter generation and DOCX export libraries

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Create + regenerate API routes

**Files:**
- Create: `src/app/api/cover-letters/route.ts`
- Create: `src/app/api/cover-letters/[id]/regenerate/route.ts`

**Interfaces:**
- Consumes: `db.coverLetter`, `db.resume`, `db.job` (Task 1); `generateCoverLetterHtml` (Task 2); `getSession` (existing).
- Produces: `POST /api/cover-letters` → `{ id }` on success. `POST /api/cover-letters/[id]/regenerate` → `{ coverLetter }` on success. Both return `{ error: string }` with 401/400/404/500 on failure. Task 5 (`CoverLetterForm`) and Task 6 (`CoverLetterEditor`) call these.

- [ ] **Step 1: Create `src/app/api/cover-letters/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { generateCoverLetterHtml } from "@/features/cover-letters/lib/generate";
  import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

  const createSchema = z.object({
    resumeId: z.string().min(1),
    jobId: z.string().optional(),
    companyName: z.string().trim().min(1).max(150).optional(),
    jobTitle: z.string().trim().min(1).max(150).optional(),
    jobDescription: z.string().trim().max(10000).optional(),
    notes: z.string().trim().max(2000).optional(),
  });

  export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    try {
      const body = await request.json();
      const parsed = createSchema.safeParse(body);
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

      let companyName: string;
      let jobTitle: string;
      let jobDescription: string | null;
      let jobId: string | null = null;

      if (parsed.data.jobId) {
        const job = await db.job.findUnique({
          where: { id: parsed.data.jobId },
          include: { company: { select: { name: true, profileJson: true } } },
        });
        if (!job) {
          return NextResponse.json({ error: "That job posting couldn't be found" }, { status: 400 });
        }
        const companyData = job.company.profileJson
          ? (JSON.parse(job.company.profileJson) as Record<string, string>)
          : null;
        companyName = companyData?.companyName ?? job.company.name ?? "the company";
        jobTitle = job.title;
        jobDescription = job.description;
        jobId = job.id;
      } else {
        if (!parsed.data.companyName || !parsed.data.jobTitle) {
          return NextResponse.json(
            { error: "Enter a company name and job title" },
            { status: 400 }
          );
        }
        companyName = parsed.data.companyName;
        jobTitle = parsed.data.jobTitle;
        jobDescription = parsed.data.jobDescription ?? null;
      }

      const answers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
      const html = await generateCoverLetterHtml(answers, {
        companyName,
        jobTitle,
        jobDescription,
        notes: parsed.data.notes ?? null,
      });

      const coverLetter = await db.coverLetter.create({
        data: {
          userId: session.userId,
          resumeId: resume.id,
          jobId,
          companyName,
          jobTitle,
          jobDescription,
          htmlContent: html,
        },
      });

      logger.info("cover-letters", "Cover letter generated", {
        coverLetterId: coverLetter.id,
        userId: session.userId,
      });
      return NextResponse.json({ id: coverLetter.id });
    } catch (error) {
      logger.error("cover-letters", "Cover letter generation failed", { error: String(error) });
      const message =
        error instanceof Error && error.message.startsWith("GROQ_API_KEY")
          ? error.message
          : "Couldn't generate that cover letter right now. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create `src/app/api/cover-letters/[id]/regenerate/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { generateCoverLetterHtml } from "@/features/cover-letters/lib/generate";
  import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

  export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const coverLetter = await db.coverLetter.findUnique({ where: { id } });
    if (!coverLetter || coverLetter.userId !== session.userId) {
      return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    }

    try {
      const resume = await db.resume.findUnique({ where: { id: coverLetter.resumeId } });
      if (!resume) {
        return NextResponse.json(
          { error: "The resume this letter was based on no longer exists" },
          { status: 400 }
        );
      }

      const answers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
      const html = await generateCoverLetterHtml(answers, {
        companyName: coverLetter.companyName,
        jobTitle: coverLetter.jobTitle,
        jobDescription: coverLetter.jobDescription,
        notes: null,
      });

      const updated = await db.coverLetter.update({ where: { id }, data: { htmlContent: html } });
      logger.info("cover-letters", "Cover letter regenerated", { coverLetterId: id, userId: session.userId });
      return NextResponse.json({ coverLetter: updated });
    } catch (error) {
      logger.error("cover-letters", "Cover letter regeneration failed", { coverLetterId: id, error: String(error) });
      const message =
        error instanceof Error && error.message.startsWith("GROQ_API_KEY")
          ? error.message
          : "Couldn't regenerate that cover letter right now. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/cover-letters/route.ts "src/app/api/cover-letters/[id]/regenerate"
  git commit -m "$(cat <<'EOF'
  Add cover letter create and regenerate API routes

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Get/update/delete + export API routes

**Files:**
- Create: `src/app/api/cover-letters/[id]/route.ts`
- Create: `src/app/api/cover-letters/[id]/export/route.ts`

**Interfaces:**
- Consumes: `db.coverLetter` (Task 1); `buildCoverLetterDocx` (Task 2); `getSession` (existing).
- Produces: `GET/PATCH/DELETE /api/cover-letters/[id]` (same shapes as the equivalent `/api/resumes/[id]` routes) and `GET /api/cover-letters/[id]/export?type=docx` (binary `.docx` response). Task 6 (`CoverLetterEditor`) calls PATCH and export.

- [ ] **Step 1: Create `src/app/api/cover-letters/[id]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";

  const updateSchema = z.object({
    htmlContent: z.string().min(1),
  });

  async function loadOwnedCoverLetter(id: string, userId: string) {
    const coverLetter = await db.coverLetter.findUnique({ where: { id } });
    if (!coverLetter || coverLetter.userId !== userId) return null;
    return coverLetter;
  }

  export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const coverLetter = await loadOwnedCoverLetter(id, session.userId);
    if (!coverLetter) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

    return NextResponse.json({ coverLetter });
  }

  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedCoverLetter(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

    try {
      const body = await request.json();
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const coverLetter = await db.coverLetter.update({ where: { id }, data: parsed.data });
      logger.info("cover-letters", "Cover letter updated", { coverLetterId: id, userId: session.userId });
      return NextResponse.json({ coverLetter });
    } catch (error) {
      logger.error("cover-letters", "Update cover letter failed", { coverLetterId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
    }
  }

  export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedCoverLetter(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

    await db.coverLetter.delete({ where: { id } });
    logger.info("cover-letters", "Cover letter deleted", { coverLetterId: id, userId: session.userId });
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 2: Create `src/app/api/cover-letters/[id]/export/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { buildCoverLetterDocx } from "@/features/cover-letters/lib/exportDocx";

  export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const coverLetter = await db.coverLetter.findUnique({ where: { id } });
    if (!coverLetter || coverLetter.userId !== session.userId) {
      return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    }

    const type = new URL(request.url).searchParams.get("type");
    if (type !== "docx") {
      return NextResponse.json({ error: "Only ?type=docx is supported here." }, { status: 400 });
    }

    try {
      const title = `Cover letter — ${coverLetter.jobTitle} at ${coverLetter.companyName}`;
      const buffer = await buildCoverLetterDocx(coverLetter.htmlContent, title);
      const filename = `${title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "cover-letter"}.docx`;

      logger.info("cover-letters", "Cover letter exported as docx", {
        coverLetterId: id,
        userId: session.userId,
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      logger.error("cover-letters", "Docx export failed", { coverLetterId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't generate the Word file. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add "src/app/api/cover-letters/[id]/route.ts" "src/app/api/cover-letters/[id]/export"
  git commit -m "$(cat <<'EOF'
  Add cover letter read/update/delete and DOCX export API routes

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: `/cover-letters/new` page + form component

**Files:**
- Create: `src/features/cover-letters/components/CoverLetterForm.tsx`
- Create: `src/app/(customer)/cover-letters/new/page.tsx`

**Interfaces:**
- Consumes: `db.resume`, `db.application`, `db.job` (Task 1); `POST /api/cover-letters` (Task 3); `requireUser` (existing).
- Produces: page at `/cover-letters/new`, reads an optional `?jobId=` query param. `CoverLetterForm({ resumes, applications, prefillJob, invalidJobId })` reused nowhere else.

- [ ] **Step 1: Create `src/features/cover-letters/components/CoverLetterForm.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";
  import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

  type ApplicationOption = { jobId: string; jobTitle: string; companyName: string };
  type PrefillJob = { jobId: string; jobTitle: string; companyName: string };

  export function CoverLetterForm({
    resumes,
    applications,
    prefillJob,
    invalidJobId,
  }: {
    resumes: { id: string; title: string }[];
    applications: ApplicationOption[];
    prefillJob: PrefillJob | null;
    invalidJobId: boolean;
  }) {
    const router = useRouter();
    const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
    const [mode, setMode] = useState<"application" | "external">(
      prefillJob ? "application" : invalidJobId ? "external" : applications.length > 0 ? "application" : "external"
    );
    const [selectedJobId, setSelectedJobId] = useState(prefillJob?.jobId ?? applications[0]?.jobId ?? "");
    const [companyName, setCompanyName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (resumes.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          You need a resume before generating a cover letter.{" "}
          <Link href="/resume-builder" className="text-indigo-700 hover:underline">
            Build one now
          </Link>
          .
        </div>
      );
    }

    async function submit() {
      setSubmitting(true);
      setError(null);
      try {
        const payload =
          mode === "application"
            ? { resumeId, jobId: selectedJobId, notes: notes.trim() || undefined }
            : {
                resumeId,
                companyName: companyName.trim(),
                jobTitle: jobTitle.trim(),
                jobDescription: jobDescription.trim() || undefined,
                notes: notes.trim() || undefined,
              };

        const res = await fetch("/api/cover-letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        router.push(`/cover-letters/${data.id}`);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    }

    const applicationOptions = [
      ...(prefillJob && !applications.some((a) => a.jobId === prefillJob.jobId)
        ? [{ value: prefillJob.jobId, label: `${prefillJob.jobTitle} at ${prefillJob.companyName}` }]
        : []),
      ...applications.map((a) => ({ value: a.jobId, label: `${a.jobTitle} at ${a.companyName}` })),
    ];

    return (
      <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
        <SelectField
          label="Resume to base it on"
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          options={resumes.map((r) => ({ value: r.id, label: r.title }))}
        />

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "application" ? "primary" : "secondary"}
              onClick={() => setMode("application")}
              disabled={applications.length === 0 && !prefillJob}
            >
              One of my applications
            </Button>
            <Button
              type="button"
              variant={mode === "external" ? "primary" : "secondary"}
              onClick={() => setMode("external")}
            >
              A different job
            </Button>
          </div>

          {mode === "application" ? (
            applicationOptions.length > 0 ? (
              <SelectField
                label="Job"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                options={applicationOptions}
              />
            ) : (
              <p className="text-sm text-slate-500">
                You haven&rsquo;t applied to any jobs yet.{" "}
                <Link href="/jobs" className="text-indigo-700 hover:underline">
                  Browse open jobs
                </Link>
                .
              </p>
            )
          ) : (
            <>
              <TextField
                label="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <TextField label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
              <TextAreaField
                label="Job description (optional, but helps a lot)"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </>
          )}
        </div>

        <TextAreaField
          label="Accomplishments to emphasize (optional)"
          placeholder="Anything specific you want the letter to highlight…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Generating…" : "Generate cover letter"}
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/cover-letters/new/page.tsx`**

  ```tsx
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { CoverLetterForm } from "@/features/cover-letters/components/CoverLetterForm";

  function companyNameFor(company: { name: string | null; profileJson: string | null }) {
    const companyData = company.profileJson ? (JSON.parse(company.profileJson) as Record<string, string>) : null;
    return companyData?.companyName ?? company.name ?? "the company";
  }

  export default async function NewCoverLetterPage({
    searchParams,
  }: {
    searchParams: Promise<{ jobId?: string }>;
  }) {
    const session = await requireUser();
    const { jobId } = await searchParams;

    const [resumes, applications, prefillJobRow] = await Promise.all([
      db.resume.findMany({
        where: { userId: session.userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.application.findMany({
        where: { userId: session.userId },
        include: { job: { include: { company: { select: { name: true, profileJson: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      jobId
        ? db.job.findUnique({
            where: { id: jobId },
            include: { company: { select: { name: true, profileJson: true } } },
          })
        : Promise.resolve(null),
    ]);

    const applicationOptions = applications.map((application) => ({
      jobId: application.job.id,
      jobTitle: application.job.title,
      companyName: companyNameFor(application.job.company),
    }));

    const prefillJob = prefillJobRow
      ? {
          jobId: prefillJobRow.id,
          jobTitle: prefillJobRow.title,
          companyName: companyNameFor(prefillJobRow.company),
        }
      : null;

    const invalidJobId = Boolean(jobId) && !prefillJobRow;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New cover letter</h1>
          <p className="mt-1 text-slate-600">
            Pick a resume and a job — we&rsquo;ll write a first draft you can review and edit.
          </p>
        </div>
        <CoverLetterForm
          resumes={resumes}
          applications={applicationOptions}
          prefillJob={prefillJob}
          invalidJobId={invalidJobId}
        />
      </div>
    );
  }
  ```

  Note the `invalidJobId` computation: `Boolean(jobId) && !prefillJobRow` is `true` only when a `jobId` query param was actually present but no matching `Job` was found — this is what makes `CoverLetterForm` fall back to "external" mode specifically for a bad deep link, while a plain visit to `/cover-letters/new` (no `jobId` param at all) still defaults sensibly to "application" mode when the customer has existing applications.

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/cover-letters/components/CoverLetterForm.tsx "src/app/(customer)/cover-letters/new"
  git commit -m "$(cat <<'EOF'
  Add cover letter generation form and its page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: `/cover-letters/[id]` editor page + component

**Files:**
- Create: `src/features/cover-letters/components/CoverLetterEditor.tsx`
- Create: `src/app/(customer)/cover-letters/[id]/page.tsx`

**Interfaces:**
- Consumes: `db.coverLetter` (Task 1); `PATCH`, `POST .../regenerate`, `GET .../export` (Tasks 3, 4); `requireUser` (existing).
- Produces: page at `/cover-letters/[id]`. `CoverLetterEditor({ coverLetterId, companyName, jobTitle, initialHtml })` reused nowhere else.

- [ ] **Step 1: Create `src/features/cover-letters/components/CoverLetterEditor.tsx`**

  ```tsx
  "use client";

  import { useRef, useState } from "react";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";

  export function CoverLetterEditor({
    coverLetterId,
    companyName,
    jobTitle,
    initialHtml,
  }: {
    coverLetterId: string;
    companyName: string;
    jobTitle: string;
    initialHtml: string;
  }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function save() {
      if (!editorRef.current) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/cover-letters/${coverLetterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ htmlContent: editorRef.current.innerHTML }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Couldn't save");
          return;
        }
        setSavedAt(new Date());
      } catch {
        setError("Couldn't reach the server. Your edits are still on screen — try saving again.");
      } finally {
        setSaving(false);
      }
    }

    async function regenerate() {
      if (
        !confirm(
          "Regenerating will discard any edits you've made since this letter was last generated or saved. Continue?"
        )
      ) {
        return;
      }
      setRegenerating(true);
      setError(null);
      try {
        const res = await fetch(`/api/cover-letters/${coverLetterId}/regenerate`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't regenerate");
          return;
        }
        if (editorRef.current) editorRef.current.innerHTML = data.coverLetter.htmlContent;
        setSavedAt(new Date());
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setRegenerating(false);
      }
    }

    async function copy() {
      if (!editorRef.current) return;
      try {
        await navigator.clipboard.writeText(editorRef.current.innerText);
      } catch {
        setError("Couldn't copy to clipboard — try selecting the text manually.");
      }
    }

    async function download() {
      setDownloading(true);
      try {
        const res = await fetch(`/api/cover-letters/${coverLetterId}/export?type=docx`);
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "cover-letter.docx";
        link.click();
        URL.revokeObjectURL(url);
      } finally {
        setDownloading(false);
      }
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {jobTitle} at {companyName}
            </h1>
            <p className="text-xs text-slate-500">
              Click directly into the letter below to edit it.{" "}
              {savedAt && <span className="text-emerald-600">Saved {savedAt.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={regenerate} disabled={regenerating}>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </Button>
            <Button variant="secondary" onClick={copy}>
              Copy
            </Button>
            <Button variant="secondary" onClick={download} disabled={downloading}>
              {downloading ? "Preparing…" : "Download"}
            </Button>
            <Link href="/cover-letters/new">
              <Button variant="ghost">Start over</Button>
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          className="min-h-[500px] rounded-lg border border-slate-200 bg-white p-10 outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/cover-letters/[id]/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { CoverLetterEditor } from "@/features/cover-letters/components/CoverLetterEditor";

  export default async function CoverLetterPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser();
    const { id } = await params;

    const coverLetter = await db.coverLetter.findUnique({ where: { id } });
    if (!coverLetter || coverLetter.userId !== session.userId) notFound();

    return (
      <CoverLetterEditor
        coverLetterId={coverLetter.id}
        companyName={coverLetter.companyName}
        jobTitle={coverLetter.jobTitle}
        initialHtml={coverLetter.htmlContent}
      />
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/cover-letters/components/CoverLetterEditor.tsx "src/app/(customer)/cover-letters/[id]"
  git commit -m "$(cat <<'EOF'
  Add cover letter editor page with save/regenerate/copy/download

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: `/cover-letters` history page + delete component

**Files:**
- Create: `src/features/cover-letters/components/CoverLetterList.tsx`
- Create: `src/app/(customer)/cover-letters/page.tsx`

**Interfaces:**
- Consumes: `db.coverLetter` (Task 1); `DELETE /api/cover-letters/[id]` (Task 4); `requireUser` (existing).
- Produces: page at `/cover-letters`. `CoverLetterList({ initialCoverLetters: CoverLetterRow[] })` where `CoverLetterRow = { id, companyName, jobTitle, createdAt }`.

- [ ] **Step 1: Create `src/features/cover-letters/components/CoverLetterList.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";

  export type CoverLetterRow = {
    id: string;
    companyName: string;
    jobTitle: string;
    createdAt: string;
  };

  export function CoverLetterList({ initialCoverLetters }: { initialCoverLetters: CoverLetterRow[] }) {
    const [coverLetters, setCoverLetters] = useState(initialCoverLetters);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function remove(id: string) {
      if (!confirm("Delete this cover letter? This can't be undone.")) return;
      setDeletingId(id);
      const previous = coverLetters;
      setCoverLetters((prev) => prev.filter((c) => c.id !== id));
      try {
        const res = await fetch(`/api/cover-letters/${id}`, { method: "DELETE" });
        if (!res.ok) setCoverLetters(previous);
      } catch {
        setCoverLetters(previous);
      } finally {
        setDeletingId(null);
      }
    }

    if (coverLetters.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">You haven&rsquo;t written any cover letters yet.</p>
        </div>
      );
    }

    return (
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {coverLetters.map((coverLetter) => (
          <li key={coverLetter.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <Link href={`/cover-letters/${coverLetter.id}`} className="font-medium text-slate-900 hover:underline">
                {coverLetter.jobTitle} at {coverLetter.companyName}
              </Link>
              <p className="text-xs text-slate-500">{new Date(coverLetter.createdAt).toLocaleDateString()}</p>
            </div>
            <Button variant="ghost" onClick={() => remove(coverLetter.id)} disabled={deletingId === coverLetter.id}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/cover-letters/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { Button } from "@/components/ui/Button";
  import { CoverLetterList, type CoverLetterRow } from "@/features/cover-letters/components/CoverLetterList";

  export default async function CoverLettersPage() {
    const session = await requireUser();

    const rows = await db.coverLetter.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, companyName: true, jobTitle: true, createdAt: true },
    });

    const coverLetters: CoverLetterRow[] = rows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      createdAt: row.createdAt.toISOString(),
    }));

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Cover letters</h1>
          <div className="flex items-center gap-3">
            <Link href="/email-templates">
              <Button variant="secondary">Email templates</Button>
            </Link>
            <Link href="/cover-letters/new">
              <Button>New cover letter</Button>
            </Link>
          </div>
        </div>
        <CoverLetterList initialCoverLetters={coverLetters} />
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/cover-letters/components/CoverLetterList.tsx "src/app/(customer)/cover-letters/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add cover letter history page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: `/email-templates` page

**Files:**
- Create: `src/features/cover-letters/components/CopyTemplateButton.tsx`
- Create: `src/app/(customer)/email-templates/page.tsx`

**Interfaces:**
- Consumes: `requireUser` (existing).
- Produces: page at `/email-templates`. `CopyTemplateButton({ text: string })` reused nowhere else. No database, no API route — pure static content.

- [ ] **Step 1: Create `src/features/cover-letters/components/CopyTemplateButton.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { Button } from "@/components/ui/Button";

  export function CopyTemplateButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard access can fail (permissions, insecure context) — the
        // template text is still fully visible on the page to select by hand.
      }
    }

    return (
      <Button variant="secondary" onClick={copy}>
        {copied ? "Copied!" : "Copy"}
      </Button>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/email-templates/page.tsx`**

  ```tsx
  import { requireUser } from "@/features/auth/lib/guard";
  import { CopyTemplateButton } from "@/features/cover-letters/components/CopyTemplateButton";

  const TEMPLATES = [
    {
      title: "Sending your application",
      subject: "Application for [Position] — [Your Name]",
      body: `Dear [Hiring Manager],

  I'm writing to apply for the [Position] role at [Company]. I've attached my resume and cover letter for your review.

  [One or two sentences on why you're a strong fit.]

  Thank you for your time and consideration — I look forward to hearing from you.

  Best regards,
  [Your Name]`,
    },
    {
      title: "Following up after applying",
      subject: "Following up on my application for [Position]",
      body: `Dear [Hiring Manager],

  I applied for the [Position] role at [Company] on [date] and wanted to follow up to confirm my application was received and reiterate my interest.

  I'd welcome the chance to discuss how my background in [relevant skill/experience] could contribute to your team.

  Thank you again for your consideration.

  Best regards,
  [Your Name]`,
    },
    {
      title: "Following up after an interview",
      subject: "Following up on our interview for [Position]",
      body: `Dear [Interviewer's Name],

  Thank you again for taking the time to speak with me about the [Position] role on [date]. I wanted to follow up and see if there's any update on next steps, or if there's any additional information I can provide.

  I remain very interested in the opportunity and enjoyed learning more about [something specific from the interview].

  Best regards,
  [Your Name]`,
    },
    {
      title: "Reaching out to a recruiter",
      subject: "Interested in opportunities at [Company]",
      body: `Hi [Recruiter's Name],

  My name is [Your Name], and I'm reaching out because I'm very interested in [Position / opportunities at Company]. I have experience in [relevant skill/field] and believe my background would be a strong match.

  I've attached my resume for your review — I'd love the chance to connect and learn more about current openings.

  Thank you for your time,
  [Your Name]`,
    },
    {
      title: "Thank-you after an interview",
      subject: "Thank you — [Position] interview",
      body: `Dear [Interviewer's Name],

  Thank you for taking the time to meet with me today about the [Position] role. I really enjoyed our conversation about [something specific], and it confirmed how excited I am about the opportunity to join [Company].

  Please let me know if there's anything else I can provide as you move forward in the process.

  Best regards,
  [Your Name]`,
    },
  ];

  export default async function EmailTemplatesPage() {
    await requireUser();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email templates</h1>
          <p className="mt-1 text-slate-600">
            Copy one of these and fill in the bracketed details — use them alongside your cover letters.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {TEMPLATES.map((template) => (
            <div key={template.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{template.title}</h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Subject: {template.subject}</p>
                </div>
                <CopyTemplateButton text={`Subject: ${template.subject}\n\n${template.body}`} />
              </div>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-slate-700">{template.body}</pre>
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/cover-letters/components/CopyTemplateButton.tsx "src/app/(customer)/email-templates"
  git commit -m "$(cat <<'EOF'
  Add static email templates page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Nav + job-detail integration

**Files:**
- Modify: `src/components/CustomerNav.tsx`
- Modify: `src/app/(customer)/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: routes from Tasks 5, 7, 8 (`/cover-letters`, `/cover-letters/new`, `/email-templates`).
- Produces: nothing consumed elsewhere — leaf changes.

- [ ] **Step 1: Add a "Cover letters" nav link in `src/components/CustomerNav.tsx`**

  Change:
  ```tsx
          <Link href="/resume-analyzer" className="text-sm text-slate-600 hover:text-slate-900">
            Analyze resume
          </Link>
          <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900">
            Jobs
          </Link>
  ```
  to:
  ```tsx
          <Link href="/resume-analyzer" className="text-sm text-slate-600 hover:text-slate-900">
            Analyze resume
          </Link>
          <Link href="/cover-letters" className="text-sm text-slate-600 hover:text-slate-900">
            Cover letters
          </Link>
          <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900">
            Jobs
          </Link>
  ```

- [ ] **Step 2: Add a "Write a cover letter for this job" link in `src/app/(customer)/jobs/[id]/page.tsx`**

  Add the `Link` import — change:
  ```tsx
  import { notFound } from "next/navigation";
  import { requireUser } from "@/features/auth/lib/guard";
  ```
  to:
  ```tsx
  import { notFound } from "next/navigation";
  import Link from "next/link";
  import { requireUser } from "@/features/auth/lib/guard";
  ```

  Then add the link right after the Apply/closed-message block — change:
  ```tsx
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
  to:
  ```tsx
        {job.status === "OPEN" ? (
          <ApplyButton
            jobId={job.id}
            resumes={resumes}
            initialStatus={existingApplication ? (existingApplication.status as ApplicationStatus) : null}
          />
        ) : (
          <p className="text-sm text-slate-500">This posting is closed and no longer accepting applications.</p>
        )}

        <Link href={`/cover-letters/new?jobId=${job.id}`} className="text-sm text-indigo-700 hover:underline">
          Write a cover letter for this job
        </Link>
      </div>
    );
  }
  ```

  (This link is available regardless of `job.status` — a customer can write a cover letter before deciding to apply, or as a reference even for a closed posting, matching the spec's "works whether or not the customer has actually applied yet.")

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/CustomerNav.tsx "src/app/(customer)/jobs/[id]/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add cover letter nav link and job-detail integration point

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 10: Final verification

**Files:** none (verification only).

**Interfaces:** none — this task consumes everything built in Tasks 1–9 as a whole.

- [ ] **Step 1: Full lint**

  Run: `npm run lint`
  Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 2: Full production build**

  Check first: `ps aux | grep "next dev" | grep -v grep`. If a `next dev` process is running **in this exact checkout** (confirm via `lsof -p <pid> | grep cwd`), do not run `rm -rf .next` — either ask whoever is running it to stop it first, or run `npx tsc --noEmit` instead of a full build.

  Otherwise:
  ```bash
  rm -rf .next && npm run build
  ```
  Expected: `✓ Compiled successfully`, and the route table includes `/cover-letters`, `/cover-letters/new`, `/cover-letters/[id]`, `/email-templates`, `/api/cover-letters`, `/api/cover-letters/[id]`, `/api/cover-letters/[id]/regenerate`, `/api/cover-letters/[id]/export`.

- [ ] **Step 3: Read-only DB sanity check**

  ```bash
  cat > .tmp-verify-final.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const count = await db.coverLetter.count();
    console.log("cover letters:", count);
    await db.coverLetter.findMany({ include: { user: true, resume: true, job: true } });
    console.log("All relation queries succeeded.");
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-final.ts
  rm -f .tmp-verify-final.ts
  ```
  Expected: count prints (likely `0`) and "All relation queries succeeded." with no Prisma errors.

- [ ] **Step 4: Manual browser smoke test**

  Requires a CUSTOMER-role account with at least one saved resume — do not create a new account to do this (that means entering a password, off-limits for an agent to do on the user's behalf); ask the project owner to run this checklist, or run it yourself only if you already have such an account available:

  1. Go to `/cover-letters` — confirm the empty state, then click "New cover letter".
  2. Generate one using "A different job" (typed-in company/title/description) — confirm it redirects to the editor with a specific, non-generic-sounding letter.
  3. Edit the letter, click Save — confirm the "Saved" timestamp appears.
  4. Click Regenerate — confirm the confirmation dialog appears, and after confirming, the content changes.
  5. Click Copy — paste somewhere and confirm the letter text (not HTML) was copied.
  6. Click Download — confirm a `.docx` file downloads and opens with readable paragraphs.
  7. Click "Start over" — confirm it goes to `/cover-letters/new` and the original letter is unaffected (still in history).
  8. Go to `/cover-letters` — confirm the new letter is listed; delete it and confirm it disappears.
  9. Go to a job detail page (`/jobs/[id]`) you haven't applied to — confirm "Write a cover letter for this job" appears and pre-fills that job on `/cover-letters/new`.
  10. On `/cover-letters/new`, confirm "One of my applications" lists your real applications and generates correctly from one.
  11. Go to `/email-templates` — confirm all 5 templates render and "Copy" works.
