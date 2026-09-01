# Cover Letter Generator — Design

Date: 2026-09-01
Status: Approved

## Purpose

Job seekers currently have no way to produce a cover letter on this
platform. This feature lets a customer generate a customized cover letter
from one of their existing resumes and a target job — either a job posted
on this platform or one described by hand — review and edit it, and
export/copy it. It also ships a small set of static email templates for
the surrounding application workflow (sending the application, following
up, thanking an interviewer, reaching out to a recruiter), since those are
a natural companion to "I just wrote a cover letter for this job."

## Scope

In scope:
- Generate a cover letter from a chosen resume + job context, via the
  existing Groq integration (`src/lib/groq.ts`), reusing the same
  system-prompt-and-zod-validation pattern as the resume analyzer.
- Job context can come from a platform job (one of the customer's own
  applications) or be typed in by hand for a job that isn't posted here.
- Review/edit the generated letter (`contentEditable`, same pattern as the
  resume editor) before using it.
- Generate / Regenerate / Edit / Copy / Download (.docx) / Start Over
  controls.
- A saved history of generated cover letters per customer (list + reopen),
  matching the resume analyzer's history pattern.
- 5 static email templates with placeholders, on their own page, no AI
  involved.
- One integration point: a "Write a cover letter for this job" link on the
  job detail page, next to Apply.

Out of scope (explicitly not building):
- AI-personalizing the email templates — confirmed static, with
  `[Company]`/`[Position]`-style placeholders the user fills in by hand.
  No API route, no database table for these.
- Any change to the Apply flow itself (`ApplyButton`, the apply API route)
  — a cover letter is a separate, optional document a customer can produce
  before or after applying; it is not attached to an `Application` row or
  required to apply.
- Sending email on the user's behalf — the email templates are text the
  user copies into their own email client. Nothing in this feature sends
  email.
- Tracking which cover letter was used for which application, or any
  cross-linking between `CoverLetter` and `Application` rows beyond the
  optional `jobId` snapshot described below.
- Company-side visibility of cover letters — these are private to the
  customer who wrote them, never shown to a company (unlike a `Resume`,
  which does get attached to an `Application` a company can see).

## Architecture

### Data model

One new table, `CoverLetter`, following the same "snapshot the job context
as plain fields, not only a foreign key" pattern already established by
`ResumeAnalysis` (`jobTitle`/`jobDescription` stored directly rather than
only referencing a `Job` row) — so a saved letter still reads correctly
even if the platform job posting it was written for is later edited or
deleted.

```prisma
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
  htmlContent String @map("html_content")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("cover_letters")
}
```

`Profile` gains `coverLetters CoverLetter[]`, `Resume` gains `coverLetters
CoverLetter[]`, `Job` gains `coverLetters CoverLetter[]`.

### Pages

Mirrors the resume builder's wizard → editor split, not the resume
analyzer's single-page pattern — a cover letter is an editable document
with its own Save/Regenerate lifecycle, not a one-shot read-only result.

- **`/cover-letters`** — server component. History list (company, job
  title, date, a snippet or just the title) ordered newest first, each row
  linking to `/cover-letters/[id]` and carrying a "Delete" action (calls
  `DELETE /api/cover-letters/[id]`, small client component per row, same
  optimistic-remove-with-rollback pattern already used by
  `ApplicantsList`'s status dropdown); a "New cover letter" button to
  `/cover-letters/new`. New link in `CustomerNav`, alongside "Jobs" /
  "Analyze resume".
- **`/cover-letters/new`** — client form. Resume picker (same "you need a
  resume first, build one" fallback as `ApplyButton` when the customer has
  zero resumes). Job source toggle: "One of my applications" (a dropdown
  of the customer's own `Application` rows, showing job title + company —
  the relevant, bounded list for manual selection) vs "A different job"
  (plain text inputs: company name, job title, job description). A
  `?jobId=` query param (see the job-detail integration point below)
  bypasses this dropdown entirely: the page server-side-fetches that one
  `Job` directly and pre-fills the company/title/description fields in
  "platform job" mode, regardless of whether the customer has actually
  applied to it — the dropdown only ever lists `Application` rows, but a
  deep link can target any `Job`. Optional accomplishments/notes free-text
  field the user can add for the prompt to emphasize (a direct answer to
  the original ask's "their relevant accomplishments"). "Generate" submits
  to `POST /api/cover-letters`, which creates the row and returns its id;
  the page redirects to `/cover-letters/[id]`.
- **`/cover-letters/[id]`** — server component loads the letter (404/redirect
  if not owned, same ownership-check pattern as every other per-id page in
  this app) and renders a client editor: a `contentEditable` div seeded
  with `htmlContent` (identical pattern to `ResumeEditor`), with a toolbar:
  **Save** (PATCH, same shape as `ResumeEditor.save()`), **Regenerate**
  (confirms first — "this discards any edits you've made since generating"
  — then calls the regenerate route and replaces the editor's content),
  **Copy** (copies the editor's current `innerText` to the clipboard),
  **Download** (`GET .../export?type=docx`), **Start Over** (plain link to
  `/cover-letters/new` — does not delete this letter; it stays in history
  unless the customer deletes it separately).
- **`/email-templates`** — server-rendered static page (no database, no
  API route). 5 templates, each with a subject line (where applicable) and
  a body containing `[Company]`, `[Position]`, `[Your Name]`-style
  placeholders, with a "Copy" button per template. Linked from
  `/cover-letters` and from `CustomerNav`.

### Generation

A single shared function, `generateCoverLetterHtml(resume, jobContext)` in
`src/features/cover-letters/lib/generate.ts`, used by both the create route
and the regenerate route — the prompt logic lives in exactly one place.
It builds a system prompt from the resume's structured `fieldsJson`
(name, experience, education, skills — the same fields the resume formats
already read) and the job's title/company/description (+ the optional
accomplishments/notes field from the form), explicitly instructing the
model to write a specific, non-generic letter that references concrete
details from both inputs, and to return simple HTML (a handful of `<p>`
tags — no headers, no styling) suitable for direct display in a
`contentEditable` box and for DOCX export. Uses `groqChat` from
`src/lib/groq.ts`, same as every other AI feature in this app — no new AI
integration.

### DOCX export

New `buildCoverLetterDocx(htmlContent, title)` in
`src/features/cover-letters/lib/exportDocx.ts`, reusing the same `docx`
package already a dependency of this project (see
`src/features/resume-builder/lib/exportDocx.ts` for the existing usage
pattern). Since a cover letter's `htmlContent` is just a sequence of
paragraphs (no nested sections like a resume), the converter splits on
`<p>` tags and strips remaining tags per paragraph into plain-text
`docx` `Paragraph`s — simpler than the resume exporter, which has to
handle repeatable sections.

### Job-detail integration point

On `/jobs/[id]` (existing customer job detail page), next to the existing
`ApplyButton`: a plain link, "Write a cover letter for this job" →
`/cover-letters/new?jobId={job.id}`. As described above, this pre-fills
the platform-job fields directly from that `Job` regardless of application
status — a customer can write a cover letter before deciding to apply.

## Error handling & edge cases

- Zero resumes: same fallback as `ApplyButton` — a message linking to
  `/resume-builder` instead of the picker.
- Groq unreachable or returns unparseable output: friendly error on the
  `/cover-letters/new` form; nothing is saved, the user can retry. Same
  failure mode as the resume analyzer and resume-upload-parse features.
- Regenerate confirmation: same `confirm()` pattern as the resume template
  switcher — a lightweight, already-proven UX for "this will discard
  something," not a full modal.
- Ownership: every `/cover-letters/[id]` route (page, PATCH, regenerate,
  export, delete) checks `coverLetter.userId === session.userId`, same
  `loadOwned*` helper pattern used throughout this codebase (e.g.
  `src/app/api/resumes/[id]/route.ts`).
- A `jobId` pre-fill from the query param that doesn't belong to the
  signed-in customer, doesn't exist, or is malformed: `/cover-letters/new`
  silently falls back to the "different job" (manual entry) mode rather
  than erroring — this is a convenience pre-fill, not a hard dependency.

## Testing plan

Same bar as every other feature in this project: `npm run lint` and
`npm run build` (or `npx tsc --noEmit` if a dev server is live in the same
checkout), plus a manual smoke test: generate a letter from a platform
job, generate one from a hand-typed external job, edit and save,
regenerate (confirm it warns and replaces content), copy, download the
.docx and confirm it opens with readable paragraphs, start over, reopen an
old letter from history, delete one, and confirm the job-detail page's new
link correctly pre-fills the job.
