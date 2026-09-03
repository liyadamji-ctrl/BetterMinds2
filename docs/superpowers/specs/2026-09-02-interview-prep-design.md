# Interview Prep — Design

Date: 2026-09-02
Status: Approved

## Purpose

Job seekers have no way to prepare for interviews on this platform today — the
landing page already promises "practice with role-specific mock interviews
and get scored feedback" (`src/app/page.tsx`), but nothing behind that promise
exists yet. This feature lets a customer generate a set of interview
questions (behavioral, technical, and job-specific) tailored to a resume and
a target job, then work through them one at a time in a practice session:
type an answer, get AI feedback and improvement suggestions, see a suggested
answer, and move to the next question — with a progress indicator, the
ability to restart the same question set, or start a fresh session.

## Scope

In scope:
- Generate ~8-10 interview questions (AI-decided mix of behavioral,
  technical, and job-specific) from a resume + job context — reusing the
  exact platform-job-vs-external-job pattern the customer already knows from
  the Cover Letter Generator.
- Each question carries a suggested answer / guidance string, generated
  alongside the question but revealed only after the customer attempts it
  themselves (not shown upfront as a spoiler).
- A practice-session UI: one question at a time, a progress indicator
  (answered / total), a textarea for a typed answer, and — on submit — a
  second, separate AI call that returns feedback and improvement
  suggestions specific to that answer.
- Restart (clears answers/feedback on the current question set, keeps the
  same questions) and "start another session" (fresh generation, old
  session kept in history).
- A saved history of past sessions, matching the Cover Letter Generator's
  history pattern.
- One integration point: a "Practice interview questions for this job"
  link on the job detail page, next to the existing cover-letter link.

Out of scope (explicitly not building):
- Any aggregate score, summary, or "interview readiness rating" across a
  whole session — the request asks for per-answer feedback and
  suggestions, not a composite grade. Adding one would be scope beyond
  what was asked.
- Voice/audio answers, timers, or any simulation of interview pressure
  (time limits, webcam, etc.) — typed answers only, matching the request's
  explicit "a way for users to submit typed answers."
- A separate "browse all questions with guidance, no practice" study mode.
  The suggested answer/guidance already exists per question — it's simply
  revealed after the customer's own attempt rather than upfront, which
  satisfies both "suggested answers for each question" and "feel like an
  actual interview preparation tool rather than a simple list of
  questions" without building two separate interfaces.
- Any change to the Apply flow, Cover Letter Generator, or Job model —
  this feature only reads `Job`/`Resume`/`Application` data, same
  read-only relationship the Cover Letter Generator already has.

## Architecture

### Data model

One new table, `InterviewSession`, following the exact job-context-snapshot
pattern `CoverLetter` already established (see
`docs/superpowers/specs/2026-09-01-cover-letter-generator-design.md`) —
`companyName`/`jobTitle`/`jobDescription` are copied at generation time
rather than only referenced via `jobId`, so a saved session still reads
correctly even if the platform job posting is later edited or deleted.

```prisma
model InterviewSession {
  id     String  @id @default(cuid())
  userId String  @db.Uuid @map("user_id")
  user   Profile @relation(fields: [userId], references: [id], onDelete: Cascade)

  resumeId String @map("resume_id")
  resume   Resume @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  /// Set when generated for a job posted on this platform; null for a
  /// hand-described external job. onDelete: SetNull, same reasoning as
  /// CoverLetter.jobId.
  jobId String? @map("job_id")
  job   Job?    @relation(fields: [jobId], references: [id], onDelete: SetNull)

  companyName    String  @map("company_name")
  jobTitle       String  @map("job_title")
  jobDescription String? @map("job_description")

  /// JSON array of questions (see shape below). Generated once at session
  /// creation; individual questions' userAnswer/feedback/suggestions fields
  /// are filled in (or cleared, on restart) as the customer works through
  /// the session. Read/written as a whole array, like ResumeAnalysis's
  /// resultJson — the array is always small (~8-10 items) and always
  /// read/written together.
  questionsJson String @map("questions_json")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("interview_sessions")
}
```

`Profile` gains `interviewSessions InterviewSession[]`, `Resume` gains
`interviewSessions InterviewSession[]`, `Job` gains
`interviewSessions InterviewSession[]`.

**Question shape** (a TypeScript type validated by zod, not a separate
Prisma model — it lives inside `questionsJson`):

```ts
type InterviewQuestion = {
  id: string;                                          // stable within the session, e.g. "q1"
  category: "behavioral" | "technical" | "job_specific";
  question: string;
  suggestedAnswer: string;
  userAnswer: string | null;
  feedback: string | null;
  suggestions: string[];                                // empty until answered
};
```

### Generation (first Groq call)

A single Groq call at session creation returns the full question array —
one system prompt asking for ~8-10 questions with an AI-decided mix of
`behavioral`/`technical`/`job_specific` categories (skipping `technical`
entirely for a non-technical role is expected and fine), each with a
`suggestedAnswer`. Built from the same kind of resume+job context the Cover
Letter Generator already assembles (candidate name/summary/experience/
education/skills + job title/company/description), using the same local
`str`/`items` helper pattern already duplicated in
`resume-builder/lib/exportDocx.ts` and `cover-letters/lib/generate.ts` —
this feature adds a third local copy rather than centralizing, continuing
the convention already reviewed and accepted twice in this codebase rather
than reaching across two already-shipped features for an unrelated
refactor.

### Feedback (second Groq call, per answer)

When the customer submits an answer to one question, a **separate** Groq
call — given just that question, its `suggestedAnswer` (as a loose rubric),
and the customer's typed answer — returns `{ feedback: string, suggestions:
string[] }` for that one answer. This is why generation and feedback are
two different calls: feedback must react to what the customer actually
wrote, which doesn't exist yet at generation time.

### Practice-session UI (`/interview-prep/[id]`)

Shows one question at a time (by `questionId`, tracked in local component
state — no "current index" persisted server-side, since "answered" is
already derivable from which questions have a non-null `userAnswer`) with a
progress indicator (`answered / total`). On page load (including a reload
mid-session), the practice view starts on the first question in
`questionsJson` order whose `userAnswer` is still `null` — so leaving and
coming back resumes where the customer left off, rather than restarting
from question 1. If every question already has an answer, it loads
straight into the completion state. A textarea collects the typed
answer; submitting calls the feedback endpoint and then reveals, together,
in this order: the feedback, the improvement suggestions, and finally the
`suggestedAnswer` — never shown before the customer's own attempt. A "Next
question" control advances; once every question has an answer, the session
shows a simple completion state (no aggregate score, per Scope) with
"Restart" and "Start another session" actions.

**Restart** clears `userAnswer`/`feedback`/`suggestions` on every question
in `questionsJson` (keeps `question`/`suggestedAnswer`/`category` — no
regeneration, no new Groq call) and returns to the first unanswered
question. **Start another session** is a plain link to
`/interview-prep/new` — it does not touch the current session, which stays
in history.

### Pages

Mirrors the Cover Letter Generator's page structure exactly:

- **`/interview-prep`** — history list (job title, company, date, and
  answered/total progress for that session), each row linking into its
  session; a "New practice session" button. New link in `CustomerNav`.
- **`/interview-prep/new`** — resume picker + the same job-source toggle
  (platform application vs. hand-typed external job) the Cover Letter
  Generator already has, including the same `?jobId=` deep-link pre-fill
  behavior (and its "invalid jobId falls back to external mode" fix,
  applied identically here). "Generate" creates the session (one Groq
  call) and redirects into it.
- **`/interview-prep/[id]`** — the practice session itself, described
  above.

### Job-detail integration point

On `/jobs/[id]`, next to the existing "Write a cover letter for this job"
link: a second link, "Practice interview questions for this job" →
`/interview-prep/new?jobId={job.id}`, available regardless of `job.status`
for the same reason the cover-letter link is (a candidate can prepare
before deciding to apply).

### Security: plain text only, never rendered as HTML

The Cover Letter Generator's final review caught a real stored-XSS finding
— untrusted, COMPANY-authored job-description text flowed into a Groq
prompt, and the model's output was rendered via `dangerouslySetInnerHTML`
with no code-level enforcement that it was actually the safe, flat content
the prompt asked for. This feature has the exact same untrusted-input shape
(a job description can come from any COMPANY-role account), so it is
designed from the start to make that vulnerability class structurally
impossible rather than needing a normalization fix after the fact:

- Every piece of AI-generated or user-typed content in this feature —
  questions, suggested answers, typed answers, feedback, suggestions — is
  plain text, always rendered via ordinary JSX text interpolation
  (`{question.question}`, etc.), which React auto-escapes.
- `dangerouslySetInnerHTML` and `contentEditable` are never used anywhere
  in this feature. There is no rich-text editing requirement here (unlike
  a cover letter, which is a document the customer edits in place) —
  plain textareas and plain text display cover every requirement in
  scope.
- The Groq system prompt does not need to ask for or accept any markup at
  all, which also simplifies the prompt compared to the cover letter
  generator's `<p>`-tag contract.
- Job description and resume text are capped before entering either
  prompt (`PROMPT_JOB_DESCRIPTION_CHARS`, `PROMPT_RESUME_CHARS`, same
  values as `resume-analyses`/`cover-letters` — 8000/15000), both to
  bound Groq cost/latency and to shrink the injection surface, matching
  the fix already applied to the Cover Letter Generator. The customer's
  own typed answer is bounded by a zod `max()` on the API route (5000
  characters is generous for a spoken-length interview answer typed out).

## Routes

- `POST /api/interview-prep` — create + generate. Body:
  `{ resumeId, jobId? , companyName?, jobTitle?, jobDescription? }` (same
  shape as `POST /api/cover-letters`). Returns `{ id }`.
- `POST /api/interview-prep/[id]/answer` — submit one answer. Body:
  `{ questionId: string, answer: string }`. Verifies session ownership,
  finds the matching question, calls Groq for feedback, updates that
  question in `questionsJson`, returns the updated question.
- `POST /api/interview-prep/[id]/restart` — clears all answers/feedback in
  the session, returns the updated session.
- `DELETE /api/interview-prep/[id]` — remove a session from history.
- `GET`s are direct server-component `db` queries (the page for
  `/interview-prep`, `/interview-prep/new`, and `/interview-prep/[id]`),
  same convention as every other feature in this app — no GET API routes.

## Error handling & edge cases

- Zero resumes: same fallback as `ApplyButton`/`CoverLetterForm` — a
  message linking to `/resume-builder`.
- Groq unreachable or malformed output on generation: friendly error on
  `/interview-prep/new`; nothing is saved.
- Groq unreachable or malformed output on a per-answer feedback call: the
  customer's typed answer is not lost (kept in the textarea/local state)
  and a retry is offered — the answer is only persisted to the database
  together with its feedback once the Groq call actually succeeds, so a
  failed feedback call never leaves a question half-updated (answer saved
  but no feedback).
- Ownership: every `/interview-prep/[id]` route checks
  `session.userId === signedInUser.userId` before acting (404 for both
  missing and not-owned, consistent with every other per-id route in this
  app).
- Answering a `questionId` that doesn't exist in the session's
  `questionsJson`: 400, not a silent no-op.
- Re-answering an already-answered question (the customer goes back and
  changes their answer): allowed — the `answer` route simply overwrites
  that question's `userAnswer`/`feedback`/`suggestions`, same as editing
  any other saved field in this app.

## Testing plan

Same bar as every other feature in this project: `npm run lint` and
`npm run build` (or `npx tsc --noEmit` if a dev server is live in the same
checkout), plus a manual smoke test: generate a session from a platform
job, generate one from a hand-typed external job, answer a question and
confirm feedback/suggestions/suggested-answer appear in the right order
and only after submitting, confirm the progress indicator updates,
restart and confirm answers clear but questions stay the same, start
another session and confirm the old one remains in history, delete a
session, and confirm the job-detail page's new link pre-fills correctly.
