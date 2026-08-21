# Resume Templates — Design

Date: 2026-08-20
Status: Approved

## Purpose

The resume builder currently offers two templates (Classic, Modern) that share
an identical wizard schema and differ only in `render()` styling. This
feature expands that to 5 templates matching provided reference designs,
adds the ability to upload an existing resume and have it parsed into the
wizard (instead of starting blank), adds photo support, and lets a user
switch a built resume's template after the fact.

## Scope

In scope:
- 5 new resume templates, replacing Classic/Modern: Minimalist, Executive,
  Elegant, Coastal, Professional (matching the 5 reference images).
- A shared, canonical wizard section schema used by all 5 templates, so any
  resume's stored answers can be re-rendered into any template.
- Photo upload as part of the wizard (new field type, new Supabase Storage
  bucket, new upload route).
- "Upload an existing resume" as an alternative starting point for the
  wizard: extract text client-side (reusing the resume-analyzer's existing
  `extractTextFromFile`), send it to a new API route that asks Groq to
  return structured answers matching the shared schema, and pre-fill the
  wizard with them for the user to review/edit before saving — never save
  directly from extraction.
- "Change template" on the resume editor: re-render the resume's stored
  answers into a newly chosen template's HTML, with a confirmation since it
  discards any manual WYSIWYG edits made since the answers were last saved.

Out of scope (explicitly not building):
- Any change to the job-application flow. `ApplyButton`'s existing "you
  need a resume — build one now" link already points at `/resume-builder`,
  which is where the new template picker lives; no code there changes.
- Extracting a photo from an uploaded resume file — a photo is only ever
  set by direct image upload in the wizard.
- Photo moderation, cropping, or editing tools — a plain file picker +
  preview is enough for v1.
- Keeping Classic/Modern as additional options — this feature replaces
  them with the 5 new templates (confirmed with the user: exactly 5 total,
  not 7).
- A "return to the job posting after building a resume" redirect chain
  from the apply flow — out of scope per the approved design; the existing
  plain link-out is enough.

## Architecture

### Shared canonical section schema

`classic.ts` and `modern.ts` today each hardcode an identical `sections`
array (a comment in `modern.ts` already calls this out: "Same section shape
as Classic on purpose"). This feature formalizes that into one shared
module, `src/features/resume-builder/formats/sections.ts`, exporting a
single `resumeSections: ResumeSection[]` that every template imports and
passes through unchanged as its own `sections`.

The shared schema is the existing personal/summary/experience/education/
skills sections, plus two additions:
- An optional `photo` field added to the `personal` section (new
  `SimpleField.type` value `"photo"`, `required: false` like every other
  optional field already in that section — a resume with no photo is
  valid for every template, including the 3 that display one).
- A new, entirely optional `languages` repeatable section (`{ language,
  proficiency }` per item, zero items is valid), needed by 2 of the 5
  reference layouts.

Every template's wizard therefore collects the same full set of fields
regardless of which template you started with — including photo and
languages, even for templates that don't visually display of them (e.g.
Minimalist doesn't render a photo, but a resume built in Minimalist still
carries a `photoUrl` field so that switching to Executive later has a photo
to show). This is what makes template-switching lossless: switching
template is exactly "call a different template's `render()` on the same
`ResumeAnswers`", nothing more.

### Five templates

All in `src/features/resume-builder/formats/`, each a `ResumeFormat` with
`sections: resumeSections` (imported, not redefined) and its own `render()`.
`render()` continues to use inline `style=` attributes exclusively (never
Tailwind classes) — this was already the convention for exporting to
DOCX/print, and it is now load-bearing: the company-side applicant preview
renders this HTML inside a sandboxed `<iframe>` with no app stylesheet
available, so inline styles are the only way these templates render
correctly there.

| id | Name | Reference | Notes |
|---|---|---|---|
| `minimalist` | Minimalist | Sebastian Bennett | Centered, black & white, bold sans header, no photo shown |
| `executive` | Executive | Thomas Hamptone | Dark sidebar with photo; contact/skills/languages on the left |
| `elegant` | Elegant | Olivia Wilson | Serif accent name, gray two-column, no photo shown |
| `coastal` | Coastal | Lauren Chen | Teal color-block header/sidebar with photo, skill bars |
| `professional` | Professional | Priya Ramanathan | Green sidebar with photo, dense corporate/legal layout |

`formats/index.ts`'s `resumeFormats` array is updated to these 5;
`classic.ts`/`modern.ts` are deleted (their content is superseded by the
shared schema + the new templates).

### Photo upload

No new database column: like every other field, the photo is a URL string
living inside the existing `Resume.fieldsJson` blob (`personal.photo`).

New Supabase Storage bucket `resume-photos`, created via a new SQL file
(`supabase/sql/009_resume_photos_storage.sql`) following the existing
"hand-run in the SQL editor" convention. Public-read (a photo the user
chose to put on an exported/shared resume is meant to be seen — same trust
level as the resume itself), with a storage policy restricting
insert/update/delete to the authenticated user's own path
(`resume-photos/{user_id}/...`).

New `POST /api/resumes/photo` route: authenticated, accepts an image file
(size/type validated server-side — reasonable caps, e.g. 5MB,
image/jpeg|png|webp only), uploads it to the user's path in the bucket via
the server Supabase client, returns the public URL. `WizardForm` gets a new
control for the `photo` field type: file picker → upload → preview, storing
the returned URL as that field's value like any other field.

### Upload-and-convert

Entry point lives on the wizard page for a chosen template
(`/resume-builder/[format]`): alongside "start blank", an "Upload an
existing resume" option. Flow:

1. Client extracts text from the uploaded PDF/DOCX/TXT using the existing
   `extractTextFromFile` (`src/features/resume-analyzer/lib/extractText.ts`)
   — no new extraction code, this utility already handles all three formats
   client-side.
2. Extracted text POSTs to a new `POST /api/resumes/parse` route.
3. That route calls the existing `groqChat` (`src/lib/groq.ts`) with a
   prompt asking for JSON matching the shared section schema's shape
   (personal fields, summary, experience[], education[], skills, 
   languages[] — never `photo`, which can't be extracted from text).
   Response validated with a new zod schema
   (`src/features/resume-builder/lib/parseSchema.ts`), same
   defensive-`.catch()`-per-field pattern as the resume-analyzer's
   `analysisResultSchema`.
4. The parsed `ResumeAnswers` (photo field absent) come back to the client
   and `WizardForm` renders pre-filled with them instead of
   `emptyAnswers(sections)` — `WizardForm` gains an optional
   `initialAnswers` prop for this.
5. The user reviews/edits every field in the normal wizard UI before
   clicking "Build my resume" — extraction never saves directly.

### Template switching

New "Change template" control on the resume editor
(`/resume-builder/edit/[id]`): a template picker (reusing the same grid UI
as the initial "choose a format" page) that, on selection, re-renders the
resume's stored `fieldsJson` through the newly chosen template's `render()`
and PATCHes the resume with both the new `format` and the newly rendered
`htmlContent`. Since this discards any manual WYSIWYG edits made in the
editor since the answers were last changed, it's gated behind a
confirmation dialog explaining exactly that.

`PATCH /api/resumes/[id]`'s existing update schema
(`{ htmlContent?, title?, status? }`) gains one more optional field:
`format?: z.string()`, validated against `getResumeFormat(format)` existing
— same shape of change as every other optional PATCH field already there.

## Data model

No new Prisma models or columns. `Resume.format` now holds one of the 5 new
format ids instead of `"classic"`/`"modern"`; `Resume.fieldsJson` gains two
new keys within its existing JSON shape (`personal.photo`, `languages`) that
old rows simply won't have (handled the same way every other optional field
already is — `str(answers, ...)` returns `""` for a missing key, `items(...)`
returns `[]`).

## Error handling & edge cases

- Photo upload: reject non-image MIME types and files over the size cap
  with a clear inline error in the wizard, same pattern as the resume
  analyzer's file-upload error states.
- Parse route: if Groq is unreachable or returns unparseable JSON, the
  route returns a friendly error and the user falls back to starting
  blank — extraction failure never blocks resume creation entirely.
- Template switch: confirmation dialog is the only guard needed: it's a
  deliberate, reversible-by-switching-back action (the underlying answers
  are never lost, only the currently-saved `htmlContent` changes).
- A resume built before this feature shipped (format `"classic"`/
  `"modern"`, no `photo`/`languages` in its `fieldsJson`) must still open
  in the editor without crashing. Since `classic.ts`/`modern.ts` are
  deleted, `getResumeFormat("classic")` returns `undefined` for such a row,
  and the edit page has no existing handling for an unknown format.
  Decision: no migration shim. The two existing resumes in the database
  (both test data created 2026-08-13, per `logs/app.log`) are pre-launch
  data and are not required to keep rendering. The edit page gets one
  small addition: if `getResumeFormat(resume.format)` is `undefined`, show
  a plain message ("This resume was built with a retired template — open
  it in a new template to keep editing") with the same "Change template"
  picker as the normal flow, instead of crashing. This reuses the
  template-switching UI rather than adding a separate code path, and costs
  nothing for any resume created after this feature ships.

## Testing plan

Same bar as every other feature in this project: `npm run lint` and
`npm run build` (or `npx tsc --noEmit` when a dev server is live in the
same checkout — see prior features' notes on not running `rm -rf .next`
against a running dev server), plus a manual smoke test: build a resume in
each of the 5 templates, upload-and-convert a real resume file, upload a
photo, switch a built resume's template, and confirm export (DOCX) and the
company-side applicant preview (sandboxed iframe) both still render
correctly with the new inline-styled templates.
