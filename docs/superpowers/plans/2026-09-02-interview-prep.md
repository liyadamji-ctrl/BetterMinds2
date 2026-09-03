# Interview Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer generate a set of interview questions (behavioral/technical/job-specific) from a resume + job context, work through them one at a time in a practice session with per-answer AI feedback, restart or start a fresh session, and keep a history.

**Architecture:** One new `InterviewSession` table storing its question set as a JSON array (mirroring `CoverLetter`'s job-context-snapshot pattern). Two separate Groq calls: one to generate the full question set at session creation, one to generate feedback each time a customer submits an answer. Every page/component in this feature renders AI-generated and user-typed content as plain text via ordinary JSX interpolation — never `dangerouslySetInnerHTML`, never `contentEditable` — which structurally avoids the stored-XSS class the Cover Letter Generator's final review had to fix after the fact.

**Tech Stack:** Next.js 14 App Router, Prisma 7 over Supabase Postgres, Groq (existing `src/lib/groq.ts`), zod, Tailwind.

**Spec:** [docs/superpowers/specs/2026-09-02-interview-prep-design.md](../specs/2026-09-02-interview-prep-design.md)

## Global Constraints

- No automated test framework exists in this repo. Per-task verification is `npx tsc --noEmit` + `npm run lint`; the final task runs `npm run build` (or `npx tsc --noEmit` only, if a dev server is live in the same checkout — check `ps aux | grep "next dev"` and confirm its cwd via `lsof -p <pid> | grep cwd` before deciding; `rm -rf .next` against a live dev server's own directory has corrupted that server's cache before in this project's history).
- New SQL file is `supabase/sql/010_interview_sessions.sql` (009 is currently the highest-numbered file), applied directly against `DATABASE_URL` the same way prior SQL files in this project were applied: a throwaway Node/tsx script using `db.$executeRawUnsafe` per statement (stripping `--` comment lines before splitting on `;`), run it, verify, delete it. The file has 5 top-level statements (create table, create index, create trigger, alter table enable RLS, create policy) — same shape as `009_cover_letters.sql`.
- Every new Prisma field maps to its snake_case column via `@map(...)`, matching every existing model exactly — a missing `@map` was a real bug caught in this project's history.
- API routes MUST use `getSession()` from `src/features/auth/lib/guard.ts` + manual ownership checks, never `requireCompany()`/`requireUser()` inside a Route Handler (those call Next's `redirect()`, which only works in Server Components/Pages).
- **Security-critical, read this before touching any rendering code in this feature:** every question, suggested answer, typed answer, feedback string, and suggestion in this feature is rendered as plain text via ordinary JSX interpolation (`{value}`), which React auto-escapes. **Never use `dangerouslySetInnerHTML` or `contentEditable` anywhere in this feature.** This is not a style preference — the Cover Letter Generator's final review found a real stored-XSS vulnerability caused by rendering AI-generated HTML from a prompt partly built from untrusted (COMPANY-authored) job-description text. This feature has the exact same untrusted-input shape, and avoids the whole vulnerability class by never treating any of this content as markup in the first place. No task in this plan needs any HTML-escaping/normalization logic as a result — if you find yourself writing one, stop, because it means something has gone off-plan.
- Job description and resume text are capped before entering either Groq prompt (`PROMPT_JOB_DESCRIPTION_CHARS = 8000`, `PROMPT_RESUME_CHARS = 15000`), matching the convention already established in `resume-analyses`/`cover-letters`, applied from the start in this feature (not retrofitted).
- The `InterviewQuestion` type (and its category union, label map, and zod schemas) lives in `src/features/interview-prep/lib/types.ts` — a plain file with **no** `server-only` import — separately from `src/features/interview-prep/lib/generate.ts`, which does have `server-only`. This split exists so client components can import the type safely; a type-only import from a `server-only`-guarded file is normally erased at compile time and thus safe in practice, but keeping the type in its own ordinary file removes any ambiguity entirely and matches how `src/features/resume-builder/formats/types.ts` (no `server-only`) is already kept separate from the resume builder's server-only pieces.
- Cover letters are private to their owner; interview sessions are exactly the same — no company-facing visibility anywhere in this plan, and no route uses `requireCompany()`/company-role checks.

---

### Task 1: Data model — Prisma schema + Supabase migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `supabase/sql/010_interview_sessions.sql`

**Interfaces:**
- Produces: Prisma model `InterviewSession` (fields: `id, userId, resumeId, jobId, companyName, jobTitle, jobDescription, questionsJson, createdAt, updatedAt`) and relation fields `Profile.interviewSessions`, `Resume.interviewSessions`, `Job.interviewSessions`. Every later task's Prisma calls depend on these exact field names.

- [ ] **Step 1: Add the `InterviewSession` model to `prisma/schema.prisma`**

  Insert this new section right before the `// --- Session recording (admin) --------------------------------------------` comment (i.e. immediately after the `CoverLetter` model):

  ```prisma
  // --- Interview prep (Groq) ----------------------------------------------

  /// One practice interview session: a generated set of questions for one
  /// resume + job, and the customer's answers/feedback as they work through
  /// it. See src/features/interview-prep/.
  model InterviewSession {
    id     String  @id @default(cuid())
    userId String  @db.Uuid @map("user_id")
    user   Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

    resumeId String @map("resume_id")
    resume   Resume @relation(fields: [resumeId], references: [id], onDelete: Cascade)

    /// Set when generated for a job posted on this platform; null for a
    /// hand-described external job. onDelete: SetNull — deleting the
    /// platform job must not delete the customer's saved session.
    jobId String? @map("job_id")
    job   Job?    @relation(fields: [jobId], references: [id], onDelete: SetNull)

    /// Always populated — copied from the platform Job at generation time,
    /// or typed in directly for an external job. Independent of jobId so a
    /// saved session keeps correct context even if the Job row changes later.
    companyName    String  @map("company_name")
    jobTitle       String  @map("job_title")
    jobDescription String? @map("job_description")

    /// JSON array of questions (see InterviewQuestion in
    /// src/features/interview-prep/lib/types.ts). Generated once at session
    /// creation; individual questions' userAnswer/feedback/suggestions are
    /// filled in (or cleared, on restart) as the customer works through the
    /// session. Always plain text, never HTML — see this plan's Global
    /// Constraints.
    questionsJson String @map("questions_json")

    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    @@index([userId])
    @@map("interview_sessions")
  }
  ```

- [ ] **Step 2: Add relation fields to `Profile`, `Resume`, and `Job`**

  In `Profile`, change:
  ```prisma
    resumes           Resume[]
    resumeAnalyses    ResumeAnalysis[]
    jobsPosted        Job[]              @relation("CompanyJobs")
    applications      Application[]      @relation("UserApplications")
    coverLetters      CoverLetter[]
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
    interviewSessions InterviewSession[]
    consent           Consent?
    sessionRecordings SessionRecording[]
  ```

  In `Resume`, change:
  ```prisma
    applications Application[]
    coverLetters CoverLetter[]
  ```
  to:
  ```prisma
    applications      Application[]
    coverLetters      CoverLetter[]
    interviewSessions InterviewSession[]
  ```

  In `Job`, change:
  ```prisma
    applications Application[]
    coverLetters CoverLetter[]
  ```
  to:
  ```prisma
    applications      Application[]
    coverLetters      CoverLetter[]
    interviewSessions InterviewSession[]
  ```

- [ ] **Step 3: Regenerate the Prisma client**

  Run: `npx prisma generate`
  Expected: `✔ Generated Prisma Client ... to ./node_modules/@prisma/client`

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 5: Create `supabase/sql/010_interview_sessions.sql`**

  ```sql
  -- Practice interview sessions: a generated question set for one resume +
  -- job, plus the customer's answers/feedback. See src/features/interview-prep/.

  create table public.interview_sessions (
    id text primary key default gen_random_uuid()::text,
    user_id uuid not null references public.profiles (id) on delete cascade,
    resume_id text not null references public.resumes (id) on delete cascade,
    job_id text references public.jobs (id) on delete set null,
    company_name text not null,
    job_title text not null,
    job_description text,
    questions_json text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index interview_sessions_user_id_idx on public.interview_sessions (user_id);

  create trigger interview_sessions_set_updated_at
    before update on public.interview_sessions
    for each row execute function public.set_updated_at();

  -- RLS: same story as every other *.sql file in supabase/sql/ — the app's
  -- own server-side checks are what actually protect this table day to
  -- day, since Prisma connects as `postgres` and bypasses RLS. This is the
  -- safety net for direct browser-side Supabase-client access.
  alter table public.interview_sessions enable row level security;

  create policy "interview_sessions: owner full access" on public.interview_sessions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  ```

- [ ] **Step 6: Apply the migration to the real database**

  ```bash
  cat > .tmp-apply-010.ts << 'EOF'
  import "dotenv/config";
  import fs from "node:fs";
  import { db } from "./src/lib/db";

  async function main() {
    const raw = fs.readFileSync("supabase/sql/010_interview_sessions.sql", "utf8");
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
  npx tsx .tmp-apply-010.ts
  rm -f .tmp-apply-010.ts
  ```
  Expected: `Applied 5 statements.`

- [ ] **Step 7: Verify the table and columns match the schema**

  ```bash
  cat > .tmp-verify-010.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const cols = await db.$queryRawUnsafe(`select column_name, is_nullable from information_schema.columns where table_name = 'interview_sessions' order by ordinal_position`);
    console.log("interview_sessions columns:", cols);
    const indexes = await db.$queryRawUnsafe(`select indexname from pg_indexes where tablename = 'interview_sessions' order by indexname`);
    console.log("indexes:", indexes);
    const triggers = await db.$queryRawUnsafe(`select trigger_name from information_schema.triggers where event_object_table = 'interview_sessions'`);
    console.log("triggers:", triggers);
    const rls = await db.$queryRawUnsafe(`select relrowsecurity from pg_class where relname = 'interview_sessions'`);
    console.log("rls enabled:", rls);
    const policies = await db.$queryRawUnsafe(`select policyname, cmd::text as cmd from pg_policies where tablename = 'interview_sessions'`);
    console.log("policies:", policies);
    const count = await db.interviewSession.count();
    console.log("db.interviewSession.count() via Prisma:", count);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-010.ts
  rm -f .tmp-verify-010.ts
  ```
  Expected: all 10 columns print in snake_case (`id, user_id, resume_id, job_id, company_name, job_title, job_description, questions_json, created_at, updated_at`, `job_id` nullable, others not-null), the index and trigger both present, `rls enabled: true`, one policy (`cmd: 'ALL'`), and `db.interviewSession.count()` returns `0` with no Prisma error — confirming every `@map` is correct.

- [ ] **Step 8: Commit**

  ```bash
  git add prisma/schema.prisma supabase/sql/010_interview_sessions.sql
  git commit -m "$(cat <<'EOF'
  Add InterviewSession data model for the interview prep feature

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Shared types + Groq generation library

**Files:**
- Create: `src/features/interview-prep/lib/types.ts`
- Create: `src/features/interview-prep/lib/generate.ts`

**Interfaces:**
- Consumes: `groqChat` from `src/lib/groq.ts` (existing), `ResumeAnswers` type from `src/features/resume-builder/formats/types.ts` (existing).
- Produces: from `types.ts` — `InterviewQuestionCategory` (`"behavioral" | "technical" | "job_specific"`), `CATEGORY_LABELS: Record<InterviewQuestionCategory, string>`, `InterviewQuestion` type (`{ id, category, question, suggestedAnswer, userAnswer: string | null, feedback: string | null, suggestions: string[] }`). From `generate.ts` — `JobContext` type (`{ companyName, jobTitle, jobDescription }`), `generateInterviewQuestions(answers: ResumeAnswers, job: JobContext): Promise<InterviewQuestion[]>`, `generateAnswerFeedback(question: InterviewQuestion, userAnswer: string): Promise<{ feedback: string; suggestions: string[] }>`. Later tasks (3, 4, 5, 6, 7) all depend on these exact names and shapes.

- [ ] **Step 1: Create `src/features/interview-prep/lib/types.ts`**

  ```typescript
  export type InterviewQuestionCategory = "behavioral" | "technical" | "job_specific";

  export const CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
    behavioral: "Behavioral",
    technical: "Technical",
    job_specific: "Job-specific",
  };

  /**
   * One question in a practice session. Every field here is plain text —
   * this type (and everywhere it's rendered) never carries HTML. See this
   * plan's Global Constraints for why that matters.
   */
  export type InterviewQuestion = {
    id: string;
    category: InterviewQuestionCategory;
    question: string;
    suggestedAnswer: string;
    userAnswer: string | null;
    feedback: string | null;
    suggestions: string[];
  };
  ```

- [ ] **Step 2: Create `src/features/interview-prep/lib/generate.ts`**

  ```typescript
  import "server-only";
  import { z } from "zod";
  import { groqChat } from "@/lib/groq";
  import type { ResumeAnswers } from "@/features/resume-builder/formats/types";
  import type { InterviewQuestion } from "./types";

  function str(answers: ResumeAnswers, section: string, field: string): string {
    const value = answers[section];
    if (!value || Array.isArray(value)) return "";
    return value[field] ?? "";
  }

  function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
    const value = answers[section];
    return Array.isArray(value) ? value : [];
  }

  // Same convention as cover-letters/resume-analyses: bounds Groq cost/latency
  // and shrinks the amount of untrusted job-description text reaching the
  // prompt. This feature avoids the stored-XSS class entirely by never
  // rendering AI output as HTML (see this plan's Global Constraints) — these
  // caps are still worth keeping for cost/latency and defense in depth.
  const PROMPT_RESUME_CHARS = 15000;
  const PROMPT_JOB_DESCRIPTION_CHARS = 8000;

  export type JobContext = {
    companyName: string;
    jobTitle: string;
    jobDescription: string | null;
  };

  const questionSchema = z.object({
    category: z.enum(["behavioral", "technical", "job_specific"]),
    question: z.string().min(1),
    suggestedAnswer: z.string().min(1),
  });

  const generatedQuestionsSchema = z.object({
    questions: z.array(questionSchema).min(1).max(15),
  });

  const feedbackSchema = z.object({
    feedback: z.string().min(1),
    suggestions: z.array(z.string()).catch([]),
  });

  const QUESTIONS_SYSTEM_PROMPT = `You are an expert interview coach helping a candidate prepare for a specific job. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "questions": [
      { "category": "behavioral" | "technical" | "job_specific", "question": "...", "suggestedAnswer": "..." }
    ]
  }

  Rules:
  - Generate 8 to 10 questions total.
  - Include a mix: a few general "behavioral" questions (teamwork, conflict, leadership, failure — the kind asked in any interview), several "job_specific" questions that reference the actual job title/description and the candidate's actual resume, and "technical" questions only when the role genuinely calls for them (skip technical questions entirely for a non-technical role).
  - "suggestedAnswer" is a short paragraph of guidance — what a strong answer would cover, not a word-for-word script — grounded in the candidate's actual resume where relevant.
  - Do not invent experience, employers, or skills for the candidate that aren't in the resume.
  - category must be exactly one of "behavioral", "technical", "job_specific".`;

  const FEEDBACK_SYSTEM_PROMPT = `You are an expert interview coach giving a candidate feedback on one practice answer. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "feedback": "...",
    "suggestions": ["...", "..."]
  }

  Rules:
  - "feedback" is 2-4 sentences of honest, specific, encouraging-but-direct assessment of the candidate's actual answer — what worked, what didn't.
  - "suggestions" is 1-4 short, concrete, actionable bullet points for how to improve this specific answer next time.
  - Judge the answer on its own merits — the "reference guidance" provided is a loose rubric, not a required script; a good answer that takes a different approach is still a good answer.
  - Never fabricate claims about what the candidate said — base feedback only on the actual answer text provided.`;

  function buildResumeTextBlock(answers: ResumeAnswers): string {
    const summary = str(answers, "summary", "summary");
    const skills = str(answers, "skills", "skills");

    const experienceText = items(answers, "experience")
      .map((item) => `- ${item.role ?? ""} at ${item.company ?? ""} (${item.dates ?? ""}): ${item.description ?? ""}`)
      .join("\n");

    const educationText = items(answers, "education")
      .map((item) => `- ${item.school ?? ""}${item.degree ? ", " + item.degree : ""} (${item.dates ?? ""})`)
      .join("\n");

    return [
      summary ? `CANDIDATE SUMMARY: ${summary}` : "",
      experienceText ? `EXPERIENCE:\n${experienceText}` : "",
      educationText ? `EDUCATION:\n${educationText}` : "",
      skills ? `SKILLS: ${skills}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, PROMPT_RESUME_CHARS);
  }

  /**
   * Generates the full question set for a new practice session. Every
   * question starts unanswered (userAnswer/feedback null, suggestions
   * empty) — the caller persists the returned array as-is into
   * InterviewSession.questionsJson.
   */
  export async function generateInterviewQuestions(
    answers: ResumeAnswers,
    job: JobContext
  ): Promise<InterviewQuestion[]> {
    const name = str(answers, "personal", "fullName");
    const resumeTextBlock = buildResumeTextBlock(answers);

    const userPrompt = [
      `CANDIDATE NAME: ${name || "the candidate"}`,
      resumeTextBlock,
      `JOB TITLE: ${job.jobTitle}`,
      `COMPANY: ${job.companyName}`,
      job.jobDescription
        ? `JOB DESCRIPTION:\n${job.jobDescription.slice(0, PROMPT_JOB_DESCRIPTION_CHARS)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await groqChat({ system: QUESTIONS_SYSTEM_PROMPT, user: userPrompt });

    let resultJson: unknown;
    try {
      resultJson = JSON.parse(raw);
    } catch {
      throw new Error("Groq returned non-JSON output");
    }

    const result = generatedQuestionsSchema.parse(resultJson);

    return result.questions.map((q, index) => ({
      id: `q${index + 1}`,
      category: q.category,
      question: q.question,
      suggestedAnswer: q.suggestedAnswer,
      userAnswer: null,
      feedback: null,
      suggestions: [],
    }));
  }

  /**
   * Generates feedback for one submitted answer. Never saves anything — the
   * caller updates the matching question in InterviewSession.questionsJson.
   */
  export async function generateAnswerFeedback(
    question: InterviewQuestion,
    userAnswer: string
  ): Promise<{ feedback: string; suggestions: string[] }> {
    const userPrompt = [
      `INTERVIEW QUESTION: ${question.question}`,
      `REFERENCE GUIDANCE (a loose rubric, not a required script): ${question.suggestedAnswer}`,
      `CANDIDATE'S ANSWER: ${userAnswer}`,
    ].join("\n\n");

    const raw = await groqChat({ system: FEEDBACK_SYSTEM_PROMPT, user: userPrompt });

    let resultJson: unknown;
    try {
      resultJson = JSON.parse(raw);
    } catch {
      throw new Error("Groq returned non-JSON output");
    }

    return feedbackSchema.parse(resultJson);
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/interview-prep/lib
  git commit -m "$(cat <<'EOF'
  Add interview prep types and Groq question/feedback generation

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Create API route

**Files:**
- Create: `src/app/api/interview-prep/route.ts`

**Interfaces:**
- Consumes: `db.interviewSession`, `db.resume`, `db.job` (Task 1); `generateInterviewQuestions` (Task 2); `getSession` (existing).
- Produces: `POST /api/interview-prep` → `{ id }` on success, `{ error: string }` with 401/400/500 on failure. Task 5's `InterviewPrepForm` calls this.

- [ ] **Step 1: Create `src/app/api/interview-prep/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { generateInterviewQuestions } from "@/features/interview-prep/lib/generate";
  import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

  const createSchema = z.object({
    resumeId: z.string().min(1),
    jobId: z.string().optional(),
    companyName: z.string().trim().min(1).max(150).optional(),
    jobTitle: z.string().trim().min(1).max(150).optional(),
    jobDescription: z.string().trim().max(10000).optional(),
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
      const questions = await generateInterviewQuestions(answers, { companyName, jobTitle, jobDescription });

      const interviewSession = await db.interviewSession.create({
        data: {
          userId: session.userId,
          resumeId: resume.id,
          jobId,
          companyName,
          jobTitle,
          jobDescription,
          questionsJson: JSON.stringify(questions),
        },
      });

      logger.info("interview-prep", "Interview session generated", {
        sessionId: interviewSession.id,
        userId: session.userId,
        questionCount: questions.length,
      });
      return NextResponse.json({ id: interviewSession.id });
    } catch (error) {
      logger.error("interview-prep", "Interview session generation failed", { error: String(error) });
      const message =
        error instanceof Error && error.message.startsWith("GROQ_API_KEY")
          ? error.message
          : "Couldn't generate interview questions right now. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/interview-prep/route.ts
  git commit -m "$(cat <<'EOF'
  Add interview prep session create API route

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Answer + restart + delete API routes

**Files:**
- Create: `src/app/api/interview-prep/[id]/answer/route.ts`
- Create: `src/app/api/interview-prep/[id]/restart/route.ts`
- Create: `src/app/api/interview-prep/[id]/route.ts`

**Interfaces:**
- Consumes: `db.interviewSession` (Task 1); `generateAnswerFeedback` (Task 2); `InterviewQuestion` type (Task 2); `getSession` (existing).
- Produces: `POST /api/interview-prep/[id]/answer` → `{ question: InterviewQuestion }` (the single updated question). `POST /api/interview-prep/[id]/restart` → `{ interviewSession }` (the full updated row, including its `questionsJson` string). `DELETE /api/interview-prep/[id]` → `{ ok: true }`. All return `{ error: string }` with 401/400/404/500 on failure. Task 6's `InterviewPractice` calls `answer` and `restart`; Task 7's `InterviewSessionList` calls `DELETE`.

- [ ] **Step 1: Create `src/app/api/interview-prep/[id]/answer/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { z } from "zod";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { generateAnswerFeedback } from "@/features/interview-prep/lib/generate";
  import type { InterviewQuestion } from "@/features/interview-prep/lib/types";

  const answerSchema = z.object({
    questionId: z.string().min(1),
    answer: z.string().trim().min(1).max(5000),
  });

  export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const interviewSession = await db.interviewSession.findUnique({ where: { id } });
    if (!interviewSession || interviewSession.userId !== session.userId) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    try {
      const body = await request.json();
      const parsed = answerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const questions = JSON.parse(interviewSession.questionsJson) as InterviewQuestion[];
      const questionIndex = questions.findIndex((q) => q.id === parsed.data.questionId);
      if (questionIndex === -1) {
        return NextResponse.json({ error: "That question doesn't exist in this session" }, { status: 400 });
      }

      // Feedback is generated (and can fail) BEFORE anything is written to
      // the database — a failed Groq call must never leave a question
      // half-updated (answer saved with no feedback).
      const { feedback, suggestions } = await generateAnswerFeedback(questions[questionIndex], parsed.data.answer);

      const updatedQuestion: InterviewQuestion = {
        ...questions[questionIndex],
        userAnswer: parsed.data.answer,
        feedback,
        suggestions,
      };
      questions[questionIndex] = updatedQuestion;

      await db.interviewSession.update({
        where: { id },
        data: { questionsJson: JSON.stringify(questions) },
      });

      logger.info("interview-prep", "Answer submitted", {
        sessionId: id,
        questionId: parsed.data.questionId,
        userId: session.userId,
      });
      return NextResponse.json({ question: updatedQuestion });
    } catch (error) {
      logger.error("interview-prep", "Answer feedback failed", { sessionId: id, error: String(error) });
      const message =
        error instanceof Error && error.message.startsWith("GROQ_API_KEY")
          ? error.message
          : "Couldn't get feedback right now. Your answer wasn't saved — please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create `src/app/api/interview-prep/[id]/restart/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import type { InterviewQuestion } from "@/features/interview-prep/lib/types";

  export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const interviewSession = await db.interviewSession.findUnique({ where: { id } });
    if (!interviewSession || interviewSession.userId !== session.userId) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    try {
      const questions = JSON.parse(interviewSession.questionsJson) as InterviewQuestion[];
      const resetQuestions: InterviewQuestion[] = questions.map((q) => ({
        ...q,
        userAnswer: null,
        feedback: null,
        suggestions: [],
      }));

      const updated = await db.interviewSession.update({
        where: { id },
        data: { questionsJson: JSON.stringify(resetQuestions) },
      });

      logger.info("interview-prep", "Session restarted", { sessionId: id, userId: session.userId });
      return NextResponse.json({ interviewSession: updated });
    } catch (error) {
      logger.error("interview-prep", "Restart failed", { sessionId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't restart the session. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Create `src/app/api/interview-prep/[id]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";

  export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const interviewSession = await db.interviewSession.findUnique({ where: { id } });
    if (!interviewSession || interviewSession.userId !== session.userId) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    await db.interviewSession.delete({ where: { id } });
    logger.info("interview-prep", "Session deleted", { sessionId: id, userId: session.userId });
    return NextResponse.json({ ok: true });
  }
  ```

  This file has no `GET`/`PATCH` — the session-detail page reads directly via `db` (see Task 6), and the only mutations are `answer`/`restart` (their own sub-routes) and `DELETE` (here).

- [ ] **Step 4: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/interview-prep
  git commit -m "$(cat <<'EOF'
  Add interview prep answer, restart, and delete API routes

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: `/interview-prep/new` page + form component

**Files:**
- Create: `src/features/interview-prep/components/InterviewPrepForm.tsx`
- Create: `src/app/(customer)/interview-prep/new/page.tsx`

**Interfaces:**
- Consumes: `db.resume`, `db.application`, `db.job` (Task 1); `POST /api/interview-prep` (Task 3); `requireUser` (existing).
- Produces: page at `/interview-prep/new`, reads an optional `?jobId=` query param. `InterviewPrepForm({ resumes, applications, prefillJob, invalidJobId })` reused nowhere else.

- [ ] **Step 1: Create `src/features/interview-prep/components/InterviewPrepForm.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";
  import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

  type ApplicationOption = { jobId: string; jobTitle: string; companyName: string };
  type PrefillJob = { jobId: string; jobTitle: string; companyName: string };

  export function InterviewPrepForm({
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
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (resumes.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          You need a resume before starting interview prep.{" "}
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
            ? { resumeId, jobId: selectedJobId }
            : {
                resumeId,
                companyName: companyName.trim(),
                jobTitle: jobTitle.trim(),
                jobDescription: jobDescription.trim() || undefined,
              };

        const res = await fetch("/api/interview-prep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        router.push(`/interview-prep/${data.id}`);
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

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Generating questions…" : "Generate practice questions"}
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/interview-prep/new/page.tsx`**

  ```tsx
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { InterviewPrepForm } from "@/features/interview-prep/components/InterviewPrepForm";

  function companyNameFor(company: { name: string | null; profileJson: string | null }) {
    const companyData = company.profileJson ? (JSON.parse(company.profileJson) as Record<string, string>) : null;
    return companyData?.companyName ?? company.name ?? "the company";
  }

  export default async function NewInterviewPrepPage({
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
          <h1 className="text-2xl font-bold text-slate-900">New practice session</h1>
          <p className="mt-1 text-slate-600">
            Pick a resume and a job — we&rsquo;ll generate interview questions to practice.
          </p>
        </div>
        <InterviewPrepForm
          resumes={resumes}
          applications={applicationOptions}
          prefillJob={prefillJob}
          invalidJobId={invalidJobId}
        />
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/interview-prep/components/InterviewPrepForm.tsx "src/app/(customer)/interview-prep/new"
  git commit -m "$(cat <<'EOF'
  Add interview prep session generation form and its page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: `/interview-prep/[id]` page + practice session component

**Files:**
- Create: `src/features/interview-prep/components/InterviewPractice.tsx`
- Create: `src/app/(customer)/interview-prep/[id]/page.tsx`

**Interfaces:**
- Consumes: `db.interviewSession` (Task 1); `InterviewQuestion`, `CATEGORY_LABELS` (Task 2); `POST .../answer`, `POST .../restart` (Task 4); `requireUser` (existing).
- Produces: page at `/interview-prep/[id]`. `InterviewPractice({ sessionId, initialQuestions })` reused nowhere else.

- [ ] **Step 1: Create `src/features/interview-prep/components/InterviewPractice.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";
  import { TextAreaField } from "@/components/ui/Field";
  import { CATEGORY_LABELS, type InterviewQuestion } from "../lib/types";

  function firstUnanswered(questions: InterviewQuestion[]): InterviewQuestion | null {
    return questions.find((q) => q.userAnswer === null) ?? null;
  }

  export function InterviewPractice({
    sessionId,
    initialQuestions,
  }: {
    sessionId: string;
    initialQuestions: InterviewQuestion[];
  }) {
    const [questions, setQuestions] = useState(initialQuestions);
    const [currentId, setCurrentId] = useState<string | null>(() => firstUnanswered(initialQuestions)?.id ?? null);
    const [answerDraft, setAnswerDraft] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const answeredCount = questions.filter((q) => q.userAnswer !== null).length;
    const current = questions.find((q) => q.id === currentId) ?? null;

    async function submitAnswer() {
      if (!current || !answerDraft.trim()) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/interview-prep/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: current.id, answer: answerDraft.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        const updated: InterviewQuestion = data.question;
        setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    }

    function goToNext() {
      const next = firstUnanswered(questions);
      setCurrentId(next?.id ?? null);
      setAnswerDraft("");
      setError(null);
    }

    async function restart() {
      if (
        !confirm("Restart this session? This clears all your answers and feedback, but keeps the same questions.")
      ) {
        return;
      }
      setRestarting(true);
      setError(null);
      try {
        const res = await fetch(`/api/interview-prep/${sessionId}/restart`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't restart");
          return;
        }
        const resetQuestions = JSON.parse(data.interviewSession.questionsJson) as InterviewQuestion[];
        setQuestions(resetQuestions);
        setCurrentId(resetQuestions[0]?.id ?? null);
        setAnswerDraft("");
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setRestarting(false);
      }
    }

    if (!current) {
      return (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <p className="font-medium text-green-900">You&rsquo;ve completed this practice session!</p>
            <p className="mt-1 text-sm text-green-800">
              {answeredCount} of {questions.length} questions answered.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={restart} disabled={restarting}>
              {restarting ? "Restarting…" : "Restart this session"}
            </Button>
            <Link href="/interview-prep/new">
              <Button>Start another session</Button>
            </Link>
          </div>
        </div>
      );
    }

    const isAnswered = current.userAnswer !== null;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>
              Question {answeredCount + (isAnswered ? 0 : 1)} of {questions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {CATEGORY_LABELS[current.category]}
          </p>
          <p className="mt-2 text-lg font-medium text-slate-900">{current.question}</p>

          {!isAnswered ? (
            <div className="mt-4 flex flex-col gap-3">
              <TextAreaField
                label="Your answer"
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button onClick={submitAnswer} disabled={submitting || !answerDraft.trim()}>
                {submitting ? "Getting feedback…" : "Submit answer"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your answer</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{current.userAnswer}</p>
              </div>
              <div className="rounded-md bg-indigo-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-indigo-900">{current.feedback}</p>
                {current.suggestions.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-indigo-900">
                    {current.suggestions.map((suggestion, i) => (
                      <li key={i}>{suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested answer</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{current.suggestedAnswer}</p>
              </div>
              <Button onClick={goToNext}>Next question</Button>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={restart} disabled={restarting}>
            {restarting ? "Restarting…" : "Restart this session"}
          </Button>
        </div>
      </div>
    );
  }
  ```

  Note: after `submitAnswer()` succeeds, `current` (derived fresh on every render from `questions.find(...)`) automatically reflects `isAnswered = true`, which is what flips the UI from the answer form to the feedback/suggestions/suggested-answer view — no separate "reveal" flag needed.

- [ ] **Step 2: Create `src/app/(customer)/interview-prep/[id]/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { InterviewPractice } from "@/features/interview-prep/components/InterviewPractice";
  import type { InterviewQuestion } from "@/features/interview-prep/lib/types";

  export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser();
    const { id } = await params;

    const interviewSession = await db.interviewSession.findUnique({ where: { id } });
    if (!interviewSession || interviewSession.userId !== session.userId) notFound();

    const questions = JSON.parse(interviewSession.questionsJson) as InterviewQuestion[];

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {interviewSession.jobTitle} at {interviewSession.companyName}
          </h1>
        </div>
        <InterviewPractice sessionId={interviewSession.id} initialQuestions={questions} />
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/interview-prep/components/InterviewPractice.tsx "src/app/(customer)/interview-prep/[id]"
  git commit -m "$(cat <<'EOF'
  Add interview practice session page with per-answer feedback

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: `/interview-prep` history page + delete component

**Files:**
- Create: `src/features/interview-prep/components/InterviewSessionList.tsx`
- Create: `src/app/(customer)/interview-prep/page.tsx`

**Interfaces:**
- Consumes: `db.interviewSession` (Task 1); `InterviewQuestion` type (Task 2); `DELETE /api/interview-prep/[id]` (Task 4); `requireUser` (existing).
- Produces: page at `/interview-prep`. `InterviewSessionList({ initialSessions: InterviewSessionRow[] })` where `InterviewSessionRow = { id, companyName, jobTitle, createdAt, answeredCount, totalCount }`.

- [ ] **Step 1: Create `src/features/interview-prep/components/InterviewSessionList.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import Link from "next/link";
  import { Button } from "@/components/ui/Button";

  export type InterviewSessionRow = {
    id: string;
    companyName: string;
    jobTitle: string;
    createdAt: string;
    answeredCount: number;
    totalCount: number;
  };

  export function InterviewSessionList({ initialSessions }: { initialSessions: InterviewSessionRow[] }) {
    const [sessions, setSessions] = useState(initialSessions);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function remove(id: string) {
      if (!confirm("Delete this practice session? This can't be undone.")) return;
      setDeletingId(id);
      const previous = sessions;
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        const res = await fetch(`/api/interview-prep/${id}`, { method: "DELETE" });
        if (!res.ok) setSessions(previous);
      } catch {
        setSessions(previous);
      } finally {
        setDeletingId(null);
      }
    }

    if (sessions.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">You haven&rsquo;t started any practice sessions yet.</p>
        </div>
      );
    }

    return (
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {sessions.map((interviewSession) => (
          <li key={interviewSession.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <Link
                href={`/interview-prep/${interviewSession.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {interviewSession.jobTitle} at {interviewSession.companyName}
              </Link>
              <p className="text-xs text-slate-500">
                {new Date(interviewSession.createdAt).toLocaleDateString()} · {interviewSession.answeredCount} of{" "}
                {interviewSession.totalCount} answered
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => remove(interviewSession.id)}
              disabled={deletingId === interviewSession.id}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    );
  }
  ```

- [ ] **Step 2: Create `src/app/(customer)/interview-prep/page.tsx`**

  ```tsx
  import Link from "next/link";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { Button } from "@/components/ui/Button";
  import {
    InterviewSessionList,
    type InterviewSessionRow,
  } from "@/features/interview-prep/components/InterviewSessionList";
  import type { InterviewQuestion } from "@/features/interview-prep/lib/types";

  export default async function InterviewPrepPage() {
    const session = await requireUser();

    const rows = await db.interviewSession.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, companyName: true, jobTitle: true, createdAt: true, questionsJson: true },
    });

    const sessions: InterviewSessionRow[] = rows.map((row) => {
      const questions = JSON.parse(row.questionsJson) as InterviewQuestion[];
      return {
        id: row.id,
        companyName: row.companyName,
        jobTitle: row.jobTitle,
        createdAt: row.createdAt.toISOString(),
        answeredCount: questions.filter((q) => q.userAnswer !== null).length,
        totalCount: questions.length,
      };
    });

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Interview prep</h1>
          <Link href="/interview-prep/new">
            <Button>New practice session</Button>
          </Link>
        </div>
        <InterviewSessionList initialSessions={sessions} />
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/interview-prep/components/InterviewSessionList.tsx "src/app/(customer)/interview-prep/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add interview prep history page

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: Nav + job-detail integration

**Files:**
- Modify: `src/components/CustomerNav.tsx`
- Modify: `src/app/(customer)/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: routes from Tasks 5, 6, 7 (`/interview-prep`, `/interview-prep/new`).
- Produces: nothing consumed elsewhere — leaf changes.

- [ ] **Step 1: Add an "Interview prep" nav link in `src/components/CustomerNav.tsx`**

  Change:
  ```tsx
          <Link href="/cover-letters" className="text-sm text-slate-600 hover:text-slate-900">
            Cover letters
          </Link>
          <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900">
            Jobs
          </Link>
  ```
  to:
  ```tsx
          <Link href="/cover-letters" className="text-sm text-slate-600 hover:text-slate-900">
            Cover letters
          </Link>
          <Link href="/interview-prep" className="text-sm text-slate-600 hover:text-slate-900">
            Interview prep
          </Link>
          <Link href="/jobs" className="text-sm text-slate-600 hover:text-slate-900">
            Jobs
          </Link>
  ```

- [ ] **Step 2: Add a "Practice interview questions for this job" link in `src/app/(customer)/jobs/[id]/page.tsx`**

  This page already has a `Link` import and an existing "Write a cover letter for this job" link (added by the Cover Letter Generator feature) — add a second link right after it. Change:
  ```tsx
        <Link href={`/cover-letters/new?jobId=${job.id}`} className="text-sm text-indigo-700 hover:underline">
          Write a cover letter for this job
        </Link>
      </div>
    );
  }
  ```
  to:
  ```tsx
        <Link href={`/cover-letters/new?jobId=${job.id}`} className="text-sm text-indigo-700 hover:underline">
          Write a cover letter for this job
        </Link>

        <Link href={`/interview-prep/new?jobId=${job.id}`} className="text-sm text-indigo-700 hover:underline">
          Practice interview questions for this job
        </Link>
      </div>
    );
  }
  ```

  (If the exact surrounding lines have drifted since this plan was written, find the existing cover-letter link in this file and add the new link directly after it, following the same `<Link href={...} className="text-sm text-indigo-700 hover:underline">` pattern.)

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/CustomerNav.tsx "src/app/(customer)/jobs/[id]/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add interview prep nav link and job-detail integration point

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Final verification

**Files:** none (verification only).

**Interfaces:** none — this task consumes everything built in Tasks 1–8 as a whole.

- [ ] **Step 1: Full lint**

  Run: `npm run lint`
  Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 2: Full production build**

  Check first: `ps aux | grep "next dev" | grep -v grep`. If a `next dev` process is running **in this exact checkout** (confirm via `lsof -p <pid> | grep cwd`), do not run `rm -rf .next` — either ask whoever is running it to stop it first, or run `npx tsc --noEmit` instead of a full build.

  Otherwise:
  ```bash
  rm -rf .next && npm run build
  ```
  Expected: `✓ Compiled successfully`, and the route table includes `/interview-prep`, `/interview-prep/new`, `/interview-prep/[id]`, `/api/interview-prep`, `/api/interview-prep/[id]`, `/api/interview-prep/[id]/answer`, `/api/interview-prep/[id]/restart`.

- [ ] **Step 3: Read-only DB sanity check**

  ```bash
  cat > .tmp-verify-final.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const count = await db.interviewSession.count();
    console.log("interview sessions:", count);
    await db.interviewSession.findMany({ include: { user: true, resume: true, job: true } });
    console.log("All relation queries succeeded.");
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-final.ts
  rm -f .tmp-verify-final.ts
  ```
  Expected: count prints (likely `0`) and "All relation queries succeeded." with no Prisma errors.

- [ ] **Step 4: Live end-to-end Groq test of both generation functions**

  This feature's two Groq-calling functions (`generateInterviewQuestions`, `generateAnswerFeedback`) are new AI logic that type-checking alone doesn't verify actually works. Both live in a `server-only`-guarded file, so a plain `tsx` script can't import them directly — inline equivalent prompts/calls in a throwaway script instead (delete it after):

  ```bash
  cat > .tmp-groq-test.ts << 'EOF'
  import "dotenv/config";
  import { z } from "zod";

  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

  async function groqChat(system: string, user: string): Promise<string> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    const data = await res.json();
    return data.choices[0].message.content;
  }

  const QUESTIONS_SYSTEM_PROMPT = `You are an expert interview coach helping a candidate prepare for a specific job. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "questions": [
      { "category": "behavioral" | "technical" | "job_specific", "question": "...", "suggestedAnswer": "..." }
    ]
  }

  Rules:
  - Generate 8 to 10 questions total.
  - Include a mix: a few general "behavioral" questions (teamwork, conflict, leadership, failure — the kind asked in any interview), several "job_specific" questions that reference the actual job title/description and the candidate's actual resume, and "technical" questions only when the role genuinely calls for them (skip technical questions entirely for a non-technical role).
  - "suggestedAnswer" is a short paragraph of guidance — what a strong answer would cover, not a word-for-word script — grounded in the candidate's actual resume where relevant.
  - Do not invent experience, employers, or skills for the candidate that aren't in the resume.
  - category must be exactly one of "behavioral", "technical", "job_specific".`;

  const FEEDBACK_SYSTEM_PROMPT = `You are an expert interview coach giving a candidate feedback on one practice answer. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "feedback": "...",
    "suggestions": ["...", "..."]
  }

  Rules:
  - "feedback" is 2-4 sentences of honest, specific, encouraging-but-direct assessment of the candidate's actual answer — what worked, what didn't.
  - "suggestions" is 1-4 short, concrete, actionable bullet points for how to improve this specific answer next time.
  - Judge the answer on its own merits — the "reference guidance" provided is a loose rubric, not a required script; a good answer that takes a different approach is still a good answer.
  - Never fabricate claims about what the candidate said — base feedback only on the actual answer text provided.`;

  const questionsUserPrompt = `CANDIDATE NAME: Jane Doe

  CANDIDATE SUMMARY: Recent CS grad with a passion for backend systems and distributed computing.

  EXPERIENCE:
  - Software Engineering Intern at Acme Corp (Jun 2025 - Aug 2025): Built a Node.js microservice handling 10k req/s, cut latency 30% via caching.

  EDUCATION:
  - UT Austin, B.S. Computer Science (2022 - 2026)

  SKILLS: TypeScript, Node.js, PostgreSQL, Docker, AWS

  JOB TITLE: Backend Engineer

  COMPANY: Acme Corp

  JOB DESCRIPTION:
  We need a backend engineer experienced with Node.js, PostgreSQL, and distributed systems to join our platform team.`;

  const questionSchema = z.object({
    category: z.enum(["behavioral", "technical", "job_specific"]),
    question: z.string().min(1),
    suggestedAnswer: z.string().min(1),
  });
  const generatedQuestionsSchema = z.object({ questions: z.array(questionSchema).min(1).max(15) });

  const feedbackSchema = z.object({
    feedback: z.string().min(1),
    suggestions: z.array(z.string()).catch([]),
  });

  async function main() {
    const rawQuestions = await groqChat(QUESTIONS_SYSTEM_PROMPT, questionsUserPrompt);
    const parsedQuestions = generatedQuestionsSchema.parse(JSON.parse(rawQuestions));
    console.log("=== Generated", parsedQuestions.questions.length, "questions ===");
    for (const q of parsedQuestions.questions) {
      console.log(`[${q.category}] ${q.question}`);
    }

    const firstQuestion = parsedQuestions.questions[0];
    const feedbackUserPrompt = [
      `INTERVIEW QUESTION: ${firstQuestion.question}`,
      `REFERENCE GUIDANCE (a loose rubric, not a required script): ${firstQuestion.suggestedAnswer}`,
      `CANDIDATE'S ANSWER: I once had a disagreement with a teammate about which caching strategy to use. I set up a quick benchmark comparing both approaches with real production-like data, showed the results in our next standup, and we picked the faster one together. It taught me to settle technical disagreements with data instead of opinions.`,
    ].join("\n\n");

    const rawFeedback = await groqChat(FEEDBACK_SYSTEM_PROMPT, feedbackUserPrompt);
    const parsedFeedback = feedbackSchema.parse(JSON.parse(rawFeedback));
    console.log("=== Feedback on a sample answer ===");
    console.log("Feedback:", parsedFeedback.feedback);
    console.log("Suggestions:", parsedFeedback.suggestions);

    process.exit(0);
  }
  main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
  EOF
  npx tsx .tmp-groq-test.ts
  rm -f .tmp-groq-test.ts
  ```
  Expected: 8-10 questions print with a sensible category mix (mostly `behavioral`/`job_specific`, `technical` present given this is a backend-engineer test case), each question text is specific rather than generic, and the feedback step returns non-empty `feedback` text plus 1-4 `suggestions` that respond to the sample answer's actual content.

- [ ] **Step 5: Manual browser smoke test**

  Requires a CUSTOMER-role account with at least one saved resume — do not create a new account to do this (that means entering a password, off-limits for an agent to do on the user's behalf); ask the project owner to run this checklist, or run it yourself only if you already have such an account available:

  1. Go to `/interview-prep` — confirm the empty state, then click "New practice session".
  2. Generate a session using "A different job" (typed-in company/title/description) — confirm it redirects to the practice view with the first question shown, progress at 0.
  3. Answer a question — confirm submitting shows feedback, suggestions, and the suggested answer, in that order, only after submitting (not before).
  4. Click "Next question" — confirm the progress bar/counter updates and a new question appears.
  5. Reload the page mid-session — confirm it resumes on the first unanswered question, not question 1.
  6. Answer all remaining questions — confirm the completion state appears with "Restart" and "Start another session".
  7. Click "Restart" — confirm the confirmation dialog appears, and after confirming, you're back on question 1 with the same question text but no answers/feedback.
  8. Go to `/interview-prep` — confirm the session shows correct answered/total progress; delete it and confirm it disappears.
  9. Go to a job detail page (`/jobs/[id]`) — confirm "Practice interview questions for this job" appears next to "Write a cover letter for this job", and pre-fills that job on `/interview-prep/new`.
  10. On `/interview-prep/new`, confirm "One of my applications" lists your real applications and generates correctly from one.
