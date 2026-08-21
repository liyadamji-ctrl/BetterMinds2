# Resume Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the resume builder's 2 templates with 5 new ones matching provided reference designs, add photo upload, add "upload an existing resume and have it parsed into the wizard" as an alternative to starting blank, and let a user switch a built resume's template afterward.

**Architecture:** All 5 templates share one canonical wizard section schema (already the de facto pattern between the 2 existing templates — this formalizes it), which is what makes template-switching lossless: switching is just calling a different template's pure `render(answers) => html` function over the same stored `fieldsJson`. Photo upload and the Groq-based resume parser are new, self-contained pieces that plug into the existing wizard/editor without changing their core shape.

**Tech Stack:** Next.js 14 App Router, Prisma 7 over Supabase Postgres (no schema changes this plan — see Global Constraints), Supabase Storage (new bucket), Groq (existing `src/lib/groq.ts`), zod, Tailwind (app UI only — template `render()` output stays inline-styled, see below).

**Spec:** [docs/superpowers/specs/2026-08-20-resume-templates-design.md](../specs/2026-08-20-resume-templates-design.md)

## Global Constraints

- No automated test framework exists in this repo. Per-task verification is `npx tsc --noEmit` + `npm run lint`; the final task runs `npm run build` (or, if a dev server is live in the same checkout, `npx tsc --noEmit` only — running `rm -rf .next` against a directory with a live `next dev` process has corrupted that server's cache before in this project's history; check `ps aux | grep "next dev"` and its cwd via `lsof -p <pid> | grep cwd` before deciding).
- **No Prisma schema changes in this plan.** The photo URL lives inside the existing `Resume.fieldsJson` JSON blob like every other field — no new column, no migration to `prisma/schema.prisma`.
- One new SQL file, `supabase/sql/009_resume_photos_storage.sql` (Storage bucket + policies, not a table), applied directly against `DATABASE_URL` in Task 2 the same way prior SQL files in this project were applied: write a throwaway Node/tsx script using `db.$executeRawUnsafe` per statement, run it, verify, delete it. That file has no leading `--` comment before its first statement, so the naive `.split(";")` approach is safe here — but strip comment lines before splitting anyway (`sql.split("\n").filter(line => !line.trim().startsWith("--")).join("\n")` then split on `;`), since this exact class of bug (a leading comment silently eating the first statement) has bitten a prior SQL file in this project.
- API routes MUST use `getSession()` from `src/features/auth/lib/guard.ts` + manual checks, never `requireCompany()`/`requireUser()` inside a Route Handler (those call Next's `redirect()`, which only works in Server Components/Pages).
- Every template's `render()` function (`src/features/resume-builder/formats/*.ts`) MUST use inline `style="..."` attributes only, never Tailwind/CSS classes. This was already the existing convention (needed for DOCX/print export); it is now also load-bearing for the company-side applicant resume preview, which renders this HTML inside a sandboxed `<iframe>` with no app stylesheet available.
- All 5 templates import `resumeSections` from `src/features/resume-builder/formats/sections.ts` **unchanged** as their own `sections` — never redefine or copy the schema per template. This is what makes template-switching lossless.
- Exactly 5 templates total (not 7) — this plan deletes `classic.ts`/`modern.ts`, it does not keep them alongside the 5 new ones.

---

### Task 1: Shared section schema, answer helpers, and the `photo` field type

**Files:**
- Create: `src/features/resume-builder/formats/sections.ts`
- Create: `src/features/resume-builder/formats/answerHelpers.ts`
- Modify: `src/features/resume-builder/formats/types.ts`

**Interfaces:**
- Produces: `resumeSections: ResumeSection[]` (exported from `sections.ts`) — the single schema every template (Task 4) and the wizard (Task 3) uses. `str(answers, section, field): string` and `items(answers, section): Array<Record<string,string>>` (exported from `answerHelpers.ts`) — used by every template's `render()`. `SimpleField.type` gains `"photo"` as a valid value.

- [ ] **Step 1: Add `"photo"` to `SimpleField.type` in `src/features/resume-builder/formats/types.ts`**

  Change:
  ```typescript
  export type SimpleField = {
    id: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea";
    placeholder?: string;
    required?: boolean;
  };
  ```
  to:
  ```typescript
  export type SimpleField = {
    id: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "photo";
    placeholder?: string;
    required?: boolean;
  };
  ```
  Nothing else in this file changes.

- [ ] **Step 2: Create `src/features/resume-builder/formats/answerHelpers.ts`**

  This extracts the `str`/`items` helpers currently duplicated verbatim inside `classic.ts`, `modern.ts`, and `exportDocx.ts` — with 5 templates instead of 2, keeping 5 copies would be real duplication debt. `exportDocx.ts` is not touched by this task (Task 4 handles it, since that's where the old templates get deleted).

  ```typescript
  import type { ResumeAnswers } from "./types";

  export function str(answers: ResumeAnswers, section: string, field: string): string {
    const value = answers[section];
    if (!value || Array.isArray(value)) return "";
    return value[field] ?? "";
  }

  export function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
    const value = answers[section];
    return Array.isArray(value) ? value : [];
  }
  ```

- [ ] **Step 3: Create `src/features/resume-builder/formats/sections.ts`**

  ```typescript
  import type { ResumeSection } from "./types";

  /**
   * The single wizard schema shared by every resume template. Every
   * template imports this unchanged as its own `sections` — a template's
   * render() chooses which of these fields to display and how, but never
   * redefines the schema itself. This is what makes switching a resume's
   * template lossless: switching is just calling a different render() over
   * the same stored answers.
   */
  export const resumeSections: ResumeSection[] = [
    {
      id: "personal",
      kind: "simple",
      title: "Personal details",
      fields: [
        { id: "fullName", label: "Full name", type: "text", required: true },
        { id: "email", label: "Email", type: "email", required: true },
        { id: "phone", label: "Phone", type: "tel" },
        { id: "location", label: "Location", type: "text", placeholder: "City, Country" },
        { id: "linkedin", label: "LinkedIn / portfolio URL", type: "text" },
        { id: "photo", label: "Photo (optional)", type: "photo" },
      ],
    },
    {
      id: "summary",
      kind: "simple",
      title: "Summary",
      fields: [{ id: "summary", label: "2–3 sentence summary", type: "textarea" }],
    },
    {
      id: "experience",
      kind: "repeatable",
      title: "Experience",
      addLabel: "Add another role",
      itemFields: [
        { id: "role", label: "Job title", type: "text", required: true },
        { id: "company", label: "Company", type: "text", required: true },
        { id: "dates", label: "Dates", type: "text", placeholder: "Jun 2024 – Present" },
        { id: "description", label: "What did you do?", type: "textarea" },
      ],
    },
    {
      id: "education",
      kind: "repeatable",
      title: "Education",
      addLabel: "Add another school",
      itemFields: [
        { id: "school", label: "School", type: "text", required: true },
        { id: "degree", label: "Degree / field", type: "text" },
        { id: "dates", label: "Dates", type: "text", placeholder: "2022 – 2026" },
      ],
    },
    {
      id: "skills",
      kind: "simple",
      title: "Skills",
      fields: [{ id: "skills", label: "Skills (comma-separated)", type: "textarea" }],
    },
    {
      id: "languages",
      kind: "repeatable",
      title: "Languages (optional)",
      addLabel: "Add another language",
      itemFields: [
        { id: "language", label: "Language", type: "text", required: true },
        { id: "proficiency", label: "Proficiency", type: "text", placeholder: "Native, Fluent, Basic…" },
      ],
    },
  ];
  ```

- [ ] **Step 4: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors. (Nothing imports these two new files yet, so this only confirms they're syntactically/type valid in isolation.)

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/resume-builder/formats/sections.ts src/features/resume-builder/formats/answerHelpers.ts src/features/resume-builder/formats/types.ts
  git commit -m "$(cat <<'EOF'
  Add shared resume section schema, answer helpers, and photo field type

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Photo storage bucket + upload API route

**Files:**
- Create: `supabase/sql/009_resume_photos_storage.sql`
- Create: `src/app/api/resumes/photo/route.ts`

**Interfaces:**
- Consumes: `getSession()` (existing), `createClient()` from `src/lib/supabase/server.ts` (existing).
- Produces: `POST /api/resumes/photo` → `{ url: string }` on success (a public URL), `{ error: string }` with 401/400/500 on failure. Task 3's photo field UI calls this.

- [ ] **Step 1: Create `supabase/sql/009_resume_photos_storage.sql`**

  ```sql
  -- Storage bucket for resume profile photos. Public-read (a photo the user
  -- chose to put on an exported/shared resume is meant to be seen — same
  -- trust level as the resume itself); write access is restricted to the
  -- authenticated user's own path (resume-photos/{user_id}/...). See
  -- src/app/api/resumes/photo/route.ts.

  insert into storage.buckets (id, name, public)
  values ('resume-photos', 'resume-photos', true)
  on conflict (id) do nothing;

  create policy "resume-photos: public read"
  on storage.objects for select
  using (bucket_id = 'resume-photos');

  create policy "resume-photos: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'resume-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  create policy "resume-photos: owner update"
  on storage.objects for update
  using (
    bucket_id = 'resume-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

  create policy "resume-photos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'resume-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
  ```

  Note: unlike the DB tables Prisma queries directly (which bypass RLS via the `postgres` role — see `supabase/sql/005_rls_policies.sql`), Storage is accessed through the Supabase JS client using the *user's own session*, so these policies are not just a safety net here — they are what actually enforces access control for uploads.

- [ ] **Step 2: Apply the migration to the real database**

  ```bash
  cat > .tmp-apply-009.ts << 'EOF'
  import "dotenv/config";
  import fs from "node:fs";
  import { db } from "./src/lib/db";

  async function main() {
    const raw = fs.readFileSync("supabase/sql/009_resume_photos_storage.sql", "utf8");
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
  Expected: `Applied 5 statements.`

- [ ] **Step 3: Verify the bucket and policies exist**

  ```bash
  cat > .tmp-verify-009.ts << 'EOF'
  import "dotenv/config";
  import { db } from "./src/lib/db";
  async function main() {
    const bucket = await db.$queryRawUnsafe(`select id, public from storage.buckets where id = 'resume-photos'`);
    const policies = await db.$queryRawUnsafe(`select policyname, cmd from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname like 'resume-photos%' order by policyname`);
    console.log("bucket:", bucket);
    console.log("policies:", policies);
    process.exit(0);
  }
  main().catch((e) => { console.error(e); process.exit(1); });
  EOF
  npx tsx .tmp-verify-009.ts
  rm -f .tmp-verify-009.ts
  ```
  Expected: `bucket:` shows one row `{ id: 'resume-photos', public: true }`; `policies:` shows all 4 policies (select/insert/update/delete).

- [ ] **Step 4: Create `src/app/api/resumes/photo/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { createClient } from "@/lib/supabase/server";

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    try {
      const supabase = await createClient();
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${session.userId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("resume-photos")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("resume-photos").getPublicUrl(path);

      logger.info("resume-builder", "Photo uploaded", { userId: session.userId, path });
      return NextResponse.json({ url: data.publicUrl });
    } catch (error) {
      logger.error("resume-builder", "Photo upload failed", { userId: session.userId, error: String(error) });
      return NextResponse.json({ error: "Couldn't upload that photo. Please try again." }, { status: 500 });
    }
  }
  ```

- [ ] **Step 5: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/sql/009_resume_photos_storage.sql src/app/api/resumes/photo
  git commit -m "$(cat <<'EOF'
  Add resume photo storage bucket and upload API route

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: `WizardForm` photo field UI + `initialAnswers` support

**Files:**
- Modify: `src/features/resume-builder/components/WizardForm.tsx`

**Interfaces:**
- Consumes: `POST /api/resumes/photo` (Task 2), `"photo"` field type (Task 1).
- Produces: `WizardForm({ format, initialAnswers? }: { format: WizardFormat; initialAnswers?: ResumeAnswers })` — the added `initialAnswers` prop, when provided, seeds the form instead of blank. Task 6's upload flow relies on this prop existing with this exact name and type.

- [ ] **Step 1: Add a `PhotoField` component inside `WizardForm.tsx`**

  Add this new function, right after the existing `Field` function (after its closing `}` on line 47, before `export function WizardForm`):

  ```typescript
  function PhotoField({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/resumes/photo", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't upload that photo.");
          return;
        }
        onChange(data.url);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setUploading(false);
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-3">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, not a Next-optimizable local asset
            <img src={value} alt="" className="h-16 w-16 rounded-full object-cover" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-800"
          />
        </div>
        {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 2: Route the `photo` field type to `PhotoField` inside the existing `Field` function**

  Change:
  ```typescript
  function Field({
    field,
    value,
    onChange,
  }: {
    field: SimpleField;
    value: string;
    onChange: (value: string) => void;
  }) {
    if (field.type === "textarea") {
  ```
  to:
  ```typescript
  function Field({
    field,
    value,
    onChange,
  }: {
    field: SimpleField;
    value: string;
    onChange: (value: string) => void;
  }) {
    if (field.type === "photo") {
      return <PhotoField label={field.label} value={value} onChange={onChange} />;
    }
    if (field.type === "textarea") {
  ```
  (Everything after this — the `textarea` branch and the final `TextField` fallback — is unchanged. TypeScript narrows `field.type` down to `"text" | "email" | "tel"` by the time it reaches the `TextField` fallback, since both `"photo"` and `"textarea"` return early above it — this keeps `<TextField type={field.type}>` type-valid.)

- [ ] **Step 3: Make the photo field span both grid columns, same as textarea fields**

  There are two places in the file with `className={field.type === "textarea" ? "sm:col-span-2" : ""}` — one for simple-section fields (~line 124) and one for repeatable-section item fields (~line 143). Change both occurrences from:
  ```typescript
  className={field.type === "textarea" ? "sm:col-span-2" : ""}
  ```
  to:
  ```typescript
  className={field.type === "textarea" || field.type === "photo" ? "sm:col-span-2" : ""}
  ```
  (The `languages` section's `itemFields` never include a `photo`-type field, so the second occurrence is only ever reached with `text`/`textarea` in practice — changing it too keeps both call sites consistent and correct if that ever changes.)

- [ ] **Step 4: Add the `initialAnswers` prop**

  Change:
  ```typescript
  export function WizardForm({ format }: { format: WizardFormat }) {
    const router = useRouter();
    const [title, setTitle] = useState(`My ${format.name} Resume`);
    const [answers, setAnswers] = useState<ResumeAnswers>(() => emptyAnswers(format.sections));
  ```
  to:
  ```typescript
  export function WizardForm({
    format,
    initialAnswers,
  }: {
    format: WizardFormat;
    initialAnswers?: ResumeAnswers;
  }) {
    const router = useRouter();
    const [title, setTitle] = useState(`My ${format.name} Resume`);
    const [answers, setAnswers] = useState<ResumeAnswers>(() => initialAnswers ?? emptyAnswers(format.sections));
  ```

- [ ] **Step 5: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors. (`resume-builder/[format]/page.tsx` still renders the old 2 formats at this point in the plan — that's fine, this task doesn't touch it; Task 4 replaces the formats and Task 6 wires up the upload entry point.)

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/resume-builder/components/WizardForm.tsx
  git commit -m "$(cat <<'EOF'
  Add photo field UI and initialAnswers support to WizardForm

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: Five new templates, replacing Classic/Modern

**Files:**
- Create: `src/features/resume-builder/formats/minimalist.ts`
- Create: `src/features/resume-builder/formats/executive.ts`
- Create: `src/features/resume-builder/formats/elegant.ts`
- Create: `src/features/resume-builder/formats/coastal.ts`
- Create: `src/features/resume-builder/formats/professional.ts`
- Modify: `src/features/resume-builder/formats/index.ts`
- Modify: `src/features/resume-builder/lib/exportDocx.ts` (comment only)
- Delete: `src/features/resume-builder/formats/classic.ts`
- Delete: `src/features/resume-builder/formats/modern.ts`

**Interfaces:**
- Consumes: `resumeSections` (Task 1), `str`/`items` (Task 1), `escapeHtml` (existing, from `./types`).
- Produces: 5 `ResumeFormat` objects with ids `minimalist`, `executive`, `elegant`, `coastal`, `professional`, registered in `resumeFormats` (existing export from `index.ts`, consumed by Tasks 6 and 7).

- [ ] **Step 1: Create `src/features/resume-builder/formats/minimalist.ts`**

  ```typescript
  import { type ResumeFormat, escapeHtml } from "./types";
  import { resumeSections } from "./sections";
  import { str, items } from "./answerHelpers";

  export const minimalistFormat: ResumeFormat = {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean black-and-white layout with a bold centered header — no photo shown.",
    sections: resumeSections,
    render(answers) {
      const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
      const contactLine = [
        str(answers, "personal", "phone"),
        str(answers, "personal", "email"),
        str(answers, "personal", "location"),
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" &nbsp;|&nbsp; ");

      const summary = escapeHtml(str(answers, "summary", "summary"));

      const experienceHtml = items(answers, "experience")
        .map(
          (item) => `
          <div style="margin-bottom:14px;">
            <div style="font-size:12px; color:#666;">${escapeHtml(item.company ?? "")} &nbsp;|&nbsp; ${escapeHtml(item.dates ?? "")}</div>
            <div style="font-weight:700; font-size:14px; margin:2px 0 4px;">${escapeHtml(item.role ?? "")}</div>
            <div style="white-space:pre-line; font-size:13px; color:#333;">${escapeHtml(item.description ?? "")}</div>
          </div>`
        )
        .join("");

      const educationHtml = items(answers, "education")
        .map(
          (item) => `
          <div style="margin-bottom:10px;">
            <div style="font-size:12px; color:#666;">${escapeHtml(item.dates ?? "")}</div>
            <div style="font-weight:700; font-size:14px;">${escapeHtml(item.school ?? "")}</div>
            ${item.degree ? `<div style="font-size:13px; color:#333;">${escapeHtml(item.degree)}</div>` : ""}
          </div>`
        )
        .join("");

      const skillsCsv = str(answers, "skills", "skills");
      const skillsHtml = skillsCsv
        ? skillsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => `<div style="font-size:13px;">${escapeHtml(s)}</div>`)
            .join("")
        : "";

      return `
        <div style="font-family: Arial, Helvetica, sans-serif; color:#111; max-width:700px;">
          <h1 style="text-align:center; font-size:32px; font-weight:800; letter-spacing:1px; margin:0 0 4px;">${name}</h1>
          <p style="text-align:center; font-size:13px; color:#555; margin:0 0 4px;">${contactLine}</p>
          <hr style="border:none; border-top:2px solid #111; margin:16px 0;" />

          ${summary ? sectionBlock("About me", `<p style="font-size:13px; color:#333;">${summary}</p>`) : ""}
          ${experienceHtml ? sectionBlock("Work experience", experienceHtml) : ""}
          ${educationHtml ? sectionBlock("Education", educationHtml) : ""}
          ${skillsHtml ? sectionBlock("Skills", `<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">${skillsHtml}</div>`) : ""}
        </div>
      `;
    },
  };

  function sectionBlock(title: string, bodyHtml: string): string {
    return `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin:0 0 8px;">${title}</h2>
        ${bodyHtml}
      </div>
    `;
  }
  ```

- [ ] **Step 2: Create `src/features/resume-builder/formats/executive.ts`**

  ```typescript
  import { type ResumeFormat, escapeHtml } from "./types";
  import { resumeSections } from "./sections";
  import { str, items } from "./answerHelpers";

  const SIDEBAR_BG = "#1f2937";

  export const executiveFormat: ResumeFormat = {
    id: "executive",
    name: "Executive",
    description: "Two-column layout with a dark sidebar, photo, and skills/languages on the left.",
    sections: resumeSections,
    render(answers) {
      const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
      const photo = str(answers, "personal", "photo");
      const email = escapeHtml(str(answers, "personal", "email"));
      const phone = escapeHtml(str(answers, "personal", "phone"));
      const location = escapeHtml(str(answers, "personal", "location"));
      const linkedin = escapeHtml(str(answers, "personal", "linkedin"));
      const summary = escapeHtml(str(answers, "summary", "summary"));

      const experienceHtml = items(answers, "experience")
        .map(
          (item) => `
          <div style="margin-bottom:14px;">
            <div style="font-weight:700; font-size:14px;">${escapeHtml(item.role ?? "")}</div>
            <div style="font-size:12px; color:#555; margin-bottom:4px;">${escapeHtml(item.company ?? "")} &nbsp;|&nbsp; ${escapeHtml(item.dates ?? "")}</div>
            <div style="white-space:pre-line; font-size:13px;">${escapeHtml(item.description ?? "")}</div>
          </div>`
        )
        .join("");

      const educationHtml = items(answers, "education")
        .map(
          (item) => `
          <div style="margin-bottom:8px;">
            <div style="font-weight:700; font-size:13px;">${escapeHtml(item.school ?? "")}</div>
            <div style="font-size:12px; color:#555;">${escapeHtml(item.degree ?? "")}${item.dates ? " &nbsp;|&nbsp; " + escapeHtml(item.dates) : ""}</div>
          </div>`
        )
        .join("");

      const skillsCsv = str(answers, "skills", "skills");
      const skillsHtml = skillsCsv
        ? `<ul style="margin:0; padding-left:16px; font-size:12px;">${skillsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`)
            .join("")}</ul>`
        : "";

      const languagesHtml = items(answers, "languages")
        .map(
          (item) =>
            `<li style="margin-bottom:4px;">${escapeHtml(item.language ?? "")}${item.proficiency ? " — " + escapeHtml(item.proficiency) : ""}</li>`
        )
        .join("");

      return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color:#111; max-width:760px; display:flex;">
          <div style="width:220px; background:${SIDEBAR_BG}; color:#fff; padding:24px; box-sizing:border-box;">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:16px;" />` : ""}
            <h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin:0 0 6px;">Contact</h2>
            <div style="font-size:12px; margin-bottom:16px; line-height:1.6;">
              ${location ? `<div>${location}</div>` : ""}
              ${phone ? `<div>${phone}</div>` : ""}
              ${email ? `<div>${email}</div>` : ""}
              ${linkedin ? `<div>${linkedin}</div>` : ""}
            </div>
            ${skillsHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin:0 0 6px;">Skills</h2>${skillsHtml}` : ""}
            ${languagesHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin:16px 0 6px;">Languages</h2><ul style="margin:0; padding-left:16px; font-size:12px;">${languagesHtml}</ul>` : ""}
          </div>
          <div style="flex:1; padding:24px; box-sizing:border-box;">
            <h1 style="font-size:26px; font-weight:700; margin:0 0 2px;">${name}</h1>
            ${summary ? `<p style="font-size:13px; color:#333; margin:8px 0 16px;">${summary}</p>` : ""}
            ${experienceHtml ? sectionBlock("Work experience", experienceHtml) : ""}
            ${educationHtml ? sectionBlock("Education", educationHtml) : ""}
          </div>
        </div>
      `;
    },
  };

  function sectionBlock(title: string, bodyHtml: string): string {
    return `
      <div style="margin-bottom:16px;">
        <h2 style="font-size:12px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #ddd; padding-bottom:4px; margin:0 0 10px;">${title}</h2>
        ${bodyHtml}
      </div>
    `;
  }
  ```

- [ ] **Step 3: Create `src/features/resume-builder/formats/elegant.ts`**

  ```typescript
  import { type ResumeFormat, escapeHtml } from "./types";
  import { resumeSections } from "./sections";
  import { str, items } from "./answerHelpers";

  const ACCENT = "#6b7280";

  export const elegantFormat: ResumeFormat = {
    id: "elegant",
    name: "Elegant",
    description: "Refined serif header with a two-column gray layout — no photo shown.",
    sections: resumeSections,
    render(answers) {
      const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
      const email = escapeHtml(str(answers, "personal", "email"));
      const phone = escapeHtml(str(answers, "personal", "phone"));
      const location = escapeHtml(str(answers, "personal", "location"));
      const linkedin = escapeHtml(str(answers, "personal", "linkedin"));
      const summary = escapeHtml(str(answers, "summary", "summary"));

      const experienceHtml = items(answers, "experience")
        .map(
          (item) => `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:13px;">
              <span>${escapeHtml(item.role ?? "")}</span>
              <span style="color:${ACCENT}; font-weight:400;">${escapeHtml(item.dates ?? "")}</span>
            </div>
            <div style="font-size:12px; color:${ACCENT}; margin-bottom:4px;">${escapeHtml(item.company ?? "")}</div>
            <div style="white-space:pre-line; font-size:13px;">${escapeHtml(item.description ?? "")}</div>
          </div>`
        )
        .join("");

      const educationHtml = items(answers, "education")
        .map(
          (item) => `
          <div style="margin-bottom:10px;">
            <div style="font-weight:700; font-size:13px;">${escapeHtml(item.school ?? "")}</div>
            <div style="font-size:12px; color:${ACCENT};">${escapeHtml(item.degree ?? "")}${item.dates ? " &nbsp;•&nbsp; " + escapeHtml(item.dates) : ""}</div>
          </div>`
        )
        .join("");

      const skillsCsv = str(answers, "skills", "skills");
      const skillsHtml = skillsCsv
        ? skillsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`)
            .join("")
        : "";

      const languagesHtml = items(answers, "languages")
        .map(
          (item) => `<li style="margin-bottom:6px;">${escapeHtml(item.language ?? "")}${item.proficiency ? " | " + escapeHtml(item.proficiency) : ""}</li>`
        )
        .join("");

      return `
        <div style="font-family: Georgia, 'Times New Roman', serif; color:#1f2937; max-width:760px; display:flex; gap:24px;">
          <div style="width:200px;">
            <h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; margin:0 0 8px;">Contact</h2>
            <div style="font-size:12px; line-height:1.8; margin-bottom:20px;">
              ${phone ? `<div>${phone}</div>` : ""}
              ${email ? `<div>${email}</div>` : ""}
              ${location ? `<div>${location}</div>` : ""}
              ${linkedin ? `<div>${linkedin}</div>` : ""}
            </div>
            ${skillsHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; margin:0 0 8px;">Skills</h2><ul style="margin:0 0 20px; padding-left:16px; font-size:12px;">${skillsHtml}</ul>` : ""}
            ${languagesHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; margin:0 0 8px;">Languages</h2><ul style="margin:0; padding-left:16px; font-size:12px;">${languagesHtml}</ul>` : ""}
          </div>
          <div style="flex:1;">
            <h1 style="font-size:30px; font-style:italic; font-weight:400; margin:0 0 4px;">${name}</h1>
            ${summary ? `<p style="font-size:13px; margin:8px 0 18px;">${summary}</p>` : ""}
            ${experienceHtml ? sectionBlock("Experience", experienceHtml) : ""}
            ${educationHtml ? sectionBlock("Education", educationHtml) : ""}
          </div>
        </div>
      `;
    },
  };

  function sectionBlock(title: string, bodyHtml: string): string {
    return `
      <div style="margin-bottom:18px;">
        <h2 style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:0 0 10px;">${title}</h2>
        ${bodyHtml}
      </div>
    `;
  }
  ```

- [ ] **Step 4: Create `src/features/resume-builder/formats/coastal.ts`**

  ```typescript
  import { type ResumeFormat, escapeHtml } from "./types";
  import { resumeSections } from "./sections";
  import { str, items } from "./answerHelpers";

  const ACCENT = "#0f5c73";

  export const coastalFormat: ResumeFormat = {
    id: "coastal",
    name: "Coastal",
    description: "Teal color-block sidebar with photo and skill bars.",
    sections: resumeSections,
    render(answers) {
      const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
      const photo = str(answers, "personal", "photo");
      const email = escapeHtml(str(answers, "personal", "email"));
      const phone = escapeHtml(str(answers, "personal", "phone"));
      const location = escapeHtml(str(answers, "personal", "location"));
      const linkedin = escapeHtml(str(answers, "personal", "linkedin"));
      const summary = escapeHtml(str(answers, "summary", "summary"));

      const experienceHtml = items(answers, "experience")
        .map(
          (item) => `
          <div style="margin-bottom:14px;">
            <div style="font-weight:700; font-size:14px; color:${ACCENT};">${escapeHtml(item.role ?? "")}</div>
            <div style="font-size:12px; color:#555; margin-bottom:4px;">${escapeHtml(item.company ?? "")} &nbsp;|&nbsp; ${escapeHtml(item.dates ?? "")}</div>
            <div style="white-space:pre-line; font-size:13px;">${escapeHtml(item.description ?? "")}</div>
          </div>`
        )
        .join("");

      const educationHtml = items(answers, "education")
        .map(
          (item) => `
          <div style="margin-bottom:8px;">
            <div style="font-weight:700; font-size:13px;">${escapeHtml(item.school ?? "")}</div>
            <div style="font-size:12px; color:#555;">${escapeHtml(item.degree ?? "")}${item.dates ? " &nbsp;|&nbsp; " + escapeHtml(item.dates) : ""}</div>
          </div>`
        )
        .join("");

      const skillsCsv = str(answers, "skills", "skills");
      const skillNames = skillsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const skillsHtml = skillNames
        .map(
          (s) => `
          <div style="margin-bottom:8px;">
            <div style="font-size:12px; margin-bottom:2px;">${escapeHtml(s)}</div>
            <div style="height:5px; background:rgba(255,255,255,0.25); border-radius:3px;">
              <div style="height:5px; width:80%; background:#fff; border-radius:3px;"></div>
            </div>
          </div>`
        )
        .join("");

      return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color:#111; max-width:760px; display:flex;">
          <div style="width:220px; background:${ACCENT}; color:#fff; padding:24px; box-sizing:border-box; text-align:center;">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:16px; border:3px solid rgba(255,255,255,0.6);" />` : ""}
            <h1 style="font-size:18px; font-weight:700; margin:0 0 20px; text-align:left;">${name}</h1>
            <h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px; text-align:left; opacity:0.85;">Contact</h2>
            <div style="font-size:12px; margin-bottom:16px; line-height:1.6; text-align:left;">
              ${phone ? `<div>${phone}</div>` : ""}
              ${email ? `<div>${email}</div>` : ""}
              ${location ? `<div>${location}</div>` : ""}
              ${linkedin ? `<div>${linkedin}</div>` : ""}
            </div>
            ${skillsHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px; text-align:left; opacity:0.85;">Skills</h2><div style="text-align:left;">${skillsHtml}</div>` : ""}
          </div>
          <div style="flex:1; padding:24px; box-sizing:border-box;">
            ${summary ? sectionBlock("Summary", `<p style="font-size:13px; color:#333;">${summary}</p>`) : ""}
            ${experienceHtml ? sectionBlock("Professional experience", experienceHtml) : ""}
            ${educationHtml ? sectionBlock("Education", educationHtml) : ""}
          </div>
        </div>
      `;
    },
  };

  function sectionBlock(title: string, bodyHtml: string): string {
    return `
      <div style="margin-bottom:16px;">
        <h2 style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; border-bottom:2px solid ${ACCENT}; padding-bottom:4px; margin:0 0 10px;">${title}</h2>
        ${bodyHtml}
      </div>
    `;
  }
  ```

- [ ] **Step 5: Create `src/features/resume-builder/formats/professional.ts`**

  ```typescript
  import { type ResumeFormat, escapeHtml } from "./types";
  import { resumeSections } from "./sections";
  import { str, items } from "./answerHelpers";

  const ACCENT = "#2f5233";

  export const professionalFormat: ResumeFormat = {
    id: "professional",
    name: "Professional",
    description: "Dense corporate layout with a green sidebar and photo — built for detailed experience.",
    sections: resumeSections,
    render(answers) {
      const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
      const photo = str(answers, "personal", "photo");
      const email = escapeHtml(str(answers, "personal", "email"));
      const phone = escapeHtml(str(answers, "personal", "phone"));
      const location = escapeHtml(str(answers, "personal", "location"));
      const linkedin = escapeHtml(str(answers, "personal", "linkedin"));
      const summary = escapeHtml(str(answers, "summary", "summary"));

      const experienceHtml = items(answers, "experience")
        .map(
          (item) => `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:13px;">
              <span>${escapeHtml(item.role ?? "")}</span>
              <span style="font-weight:400; color:#555;">${escapeHtml(item.dates ?? "")}</span>
            </div>
            <div style="font-size:12px; color:${ACCENT}; margin-bottom:4px;">${escapeHtml(item.company ?? "")}</div>
            <div style="white-space:pre-line; font-size:12px;">${escapeHtml(item.description ?? "")}</div>
          </div>`
        )
        .join("");

      const educationHtml = items(answers, "education")
        .map(
          (item) => `
          <div style="margin-bottom:8px;">
            <div style="font-weight:700; font-size:13px;">${escapeHtml(item.degree || item.school || "")}</div>
            <div style="font-size:12px; color:#555;">${escapeHtml(item.school ?? "")}${item.dates ? " | " + escapeHtml(item.dates) : ""}</div>
          </div>`
        )
        .join("");

      const skillsCsv = str(answers, "skills", "skills");
      const skillsHtml = skillsCsv
        ? `<ul style="margin:0; padding-left:16px; font-size:12px;">${skillsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`)
            .join("")}</ul>`
        : "";

      const languagesHtml = items(answers, "languages")
        .map(
          (item) =>
            `<li style="margin-bottom:4px;">${escapeHtml(item.language ?? "")}${item.proficiency ? " — " + escapeHtml(item.proficiency) : ""}</li>`
        )
        .join("");

      return `
        <div style="font-family: Arial, Helvetica, sans-serif; color:#111; max-width:760px; display:flex;">
          <div style="width:200px; background:${ACCENT}; color:#fff; padding:20px; box-sizing:border-box; text-align:center;">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="" style="width:90px; height:90px; border-radius:50%; object-fit:cover; margin-bottom:14px;" />` : ""}
            <h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px; text-align:left; opacity:0.85;">Contact</h2>
            <div style="font-size:11px; margin-bottom:14px; line-height:1.6; text-align:left; word-break:break-word;">
              ${location ? `<div>${location}</div>` : ""}
              ${phone ? `<div>${phone}</div>` : ""}
              ${email ? `<div>${email}</div>` : ""}
              ${linkedin ? `<div>${linkedin}</div>` : ""}
            </div>
            ${skillsHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px; text-align:left; opacity:0.85;">Key skills</h2><div style="text-align:left;">${skillsHtml}</div>` : ""}
            ${languagesHtml ? `<h2 style="font-size:11px; text-transform:uppercase; letter-spacing:1px; margin:14px 0 6px; text-align:left; opacity:0.85;">Languages</h2><ul style="margin:0; padding-left:16px; font-size:11px; text-align:left;">${languagesHtml}</ul>` : ""}
          </div>
          <div style="flex:1; padding:20px; box-sizing:border-box;">
            <h1 style="font-size:24px; font-weight:700; margin:0 0 4px;">${name}</h1>
            ${summary ? `<p style="font-size:12px; color:#333; margin:6px 0 16px;">${summary}</p>` : ""}
            ${experienceHtml ? sectionBlock("Professional experience", experienceHtml) : ""}
            ${educationHtml ? sectionBlock("Education", educationHtml) : ""}
          </div>
        </div>
      `;
    },
  };

  function sectionBlock(title: string, bodyHtml: string): string {
    return `
      <div style="margin-bottom:14px;">
        <h2 style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; border-bottom:1px solid #ddd; padding-bottom:4px; margin:0 0 8px;">${title}</h2>
        ${bodyHtml}
      </div>
    `;
  }
  ```

- [ ] **Step 6: Replace `src/features/resume-builder/formats/index.ts`**

  ```typescript
  import type { ResumeFormat } from "./types";
  import { minimalistFormat } from "./minimalist";
  import { executiveFormat } from "./executive";
  import { elegantFormat } from "./elegant";
  import { coastalFormat } from "./coastal";
  import { professionalFormat } from "./professional";

  /**
   * Every available resume format, in one place. To add a new one:
   *   1. Copy an existing template (e.g. minimalist.ts) to `<id>.ts`.
   *   2. Change `id`, `name`, `description`, and the `render()` styling —
   *      keep `sections: resumeSections` unchanged so template-switching
   *      stays lossless (see formats/sections.ts).
   *   3. Register it below.
   * The wizard, editor, and export buttons are all generic — they read
   * whatever is in this list and need no changes for a new format.
   */
  export const resumeFormats: ResumeFormat[] = [
    minimalistFormat,
    executiveFormat,
    elegantFormat,
    coastalFormat,
    professionalFormat,
  ];

  export function getResumeFormat(id: string): ResumeFormat | undefined {
    return resumeFormats.find((f) => f.id === id);
  }

  export * from "./types";
  ```

- [ ] **Step 7: Delete the old templates**

  ```bash
  rm src/features/resume-builder/formats/classic.ts
  rm src/features/resume-builder/formats/modern.ts
  ```

- [ ] **Step 8: Update the stale comment in `exportDocx.ts`**

  This file needs no functional change (its `str`/`items` helpers already work against any format's answers, regardless of which template rendered them) — only its doc comment names the two files just deleted. Change:
  ```typescript
  /**
   * Builds a .docx directly from the wizard answers (not from the preview
   * HTML) so the export never depends on a headless browser or any paid
   * conversion service — the `docx` package writes the file format itself.
   *
   * This assumes the common section shape (personal / summary / experience /
   * education / skills) that classic.ts and modern.ts both use. A format with
   * a different shape would need its own export function alongside its own
   * render() — see formats/index.ts for the pattern.
   */
  ```
  to:
  ```typescript
  /**
   * Builds a .docx directly from the wizard answers (not from the preview
   * HTML) so the export never depends on a headless browser or any paid
   * conversion service — the `docx` package writes the file format itself.
   *
   * This assumes the shared section shape every template in formats/ uses
   * (see formats/sections.ts) — personal / summary / experience / education
   * / skills. A format with a different shape would need its own export
   * function alongside its own render() — see formats/index.ts for the
   * pattern.
   */
  ```

- [ ] **Step 9: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors. This is the first task where any code actually imports `sections.ts`/`answerHelpers.ts` from Task 1 — if either has a type mismatch, it surfaces here.

- [ ] **Step 10: Commit**

  ```bash
  git add src/features/resume-builder/formats src/features/resume-builder/lib/exportDocx.ts
  git commit -m "$(cat <<'EOF'
  Replace Classic/Modern with 5 new resume templates

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: Resume parse schema + API route

**Files:**
- Create: `src/features/resume-builder/lib/parseSchema.ts`
- Create: `src/app/api/resumes/parse/route.ts`

**Interfaces:**
- Consumes: `groqChat` from `src/lib/groq.ts` (existing), `getSession` (existing).
- Produces: `POST /api/resumes/parse` → `{ answers: ParsedResume }` on success, `{ error: string }` with 401/400/500 on failure. `ParsedResume` (exported from `parseSchema.ts`) is structurally assignable to `ResumeAnswers` (same key/value shapes, minus `photo`) — Task 6's upload UI passes the response straight through as `WizardForm`'s `initialAnswers`.

- [ ] **Step 1: Create `src/features/resume-builder/lib/parseSchema.ts`**

  ```typescript
  import { z } from "zod";

  /**
   * Shape Groq is asked to extract an uploaded resume's text into. Mirrors
   * the shared wizard schema (src/features/resume-builder/formats/sections.ts)
   * minus `photo`, which can't be extracted from text — the user uploads a
   * photo separately in the wizard if they want one.
   */
  const experienceItemSchema = z.object({
    role: z.string().catch(""),
    company: z.string().catch(""),
    dates: z.string().catch(""),
    description: z.string().catch(""),
  });

  const educationItemSchema = z.object({
    school: z.string().catch(""),
    degree: z.string().catch(""),
    dates: z.string().catch(""),
  });

  const languageItemSchema = z.object({
    language: z.string().catch(""),
    proficiency: z.string().catch(""),
  });

  export const parsedResumeSchema = z.object({
    personal: z
      .object({
        fullName: z.string().catch(""),
        email: z.string().catch(""),
        phone: z.string().catch(""),
        location: z.string().catch(""),
        linkedin: z.string().catch(""),
      })
      .catch({ fullName: "", email: "", phone: "", location: "", linkedin: "" }),
    summary: z.object({ summary: z.string().catch("") }).catch({ summary: "" }),
    experience: z.array(experienceItemSchema).catch([]),
    education: z.array(educationItemSchema).catch([]),
    skills: z.object({ skills: z.string().catch("") }).catch({ skills: "" }),
    languages: z.array(languageItemSchema).catch([]),
  });

  export type ParsedResume = z.infer<typeof parsedResumeSchema>;

  export const parseRequestSchema = z.object({
    resumeText: z
      .string()
      .trim()
      .min(30, "That doesn't look like enough resume text to work with.")
      .max(50000, "Resume text is too long — try a shorter file."),
  });
  ```

- [ ] **Step 2: Create `src/app/api/resumes/parse/route.ts`**

  ```typescript
  import { NextResponse } from "next/server";
  import { logger } from "@/lib/logger";
  import { getSession } from "@/features/auth/lib/guard";
  import { groqChat } from "@/lib/groq";
  import { parseRequestSchema, parsedResumeSchema } from "@/features/resume-builder/lib/parseSchema";

  const SYSTEM_PROMPT = `You extract structured data from resume text. Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
  {
    "personal": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "" },
    "summary": { "summary": "" },
    "experience": [{ "role": "", "company": "", "dates": "", "description": "" }],
    "education": [{ "school": "", "degree": "", "dates": "" }],
    "skills": { "skills": "" },
    "languages": [{ "language": "", "proficiency": "" }]
  }

  Rules:
  - "skills" is a single comma-separated string, not an array.
  - Every array may be empty if nothing relevant is found.
  - Leave a field as an empty string if you can't find it — never invent information.
  - "description" for each experience entry should be the original bullet points, joined with newlines.`;

  export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    let parsed;
    try {
      const body = await request.json();
      parsed = parseRequestSchema.safeParse(body);
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    try {
      const raw = await groqChat({ system: SYSTEM_PROMPT, user: parsed.data.resumeText });

      let resultJson: unknown;
      try {
        resultJson = JSON.parse(raw);
      } catch {
        throw new Error("Groq returned non-JSON output");
      }

      const result = parsedResumeSchema.parse(resultJson);

      logger.info("resume-builder", "Resume parsed from upload", { userId: session.userId });
      return NextResponse.json({ answers: result });
    } catch (error) {
      logger.error("resume-builder", "Resume parse failed", { userId: session.userId, error: String(error) });
      const message =
        error instanceof Error && error.message.startsWith("GROQ_API_KEY")
          ? error.message
          : "Couldn't read that resume right now. Please try again or start blank.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/resume-builder/lib/parseSchema.ts src/app/api/resumes/parse
  git commit -m "$(cat <<'EOF'
  Add Groq-based resume parsing schema and API route

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Upload-and-convert entry point on the wizard page

**Files:**
- Create: `src/features/resume-builder/components/ResumeWizardEntry.tsx`
- Modify: `src/app/(customer)/resume-builder/[format]/page.tsx`

**Interfaces:**
- Consumes: `extractTextFromFile` from `src/features/resume-analyzer/lib/extractText.ts` (existing — intentional cross-feature reuse, see the spec), `POST /api/resumes/parse` (Task 5), `WizardForm`/`WizardFormat`/`initialAnswers` prop (Task 3).
- Produces: `ResumeWizardEntry({ format: WizardFormat })` — the page's new top-level component, replacing a direct `WizardForm` render.

- [ ] **Step 1: Create `src/features/resume-builder/components/ResumeWizardEntry.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { Button } from "@/components/ui/Button";
  import { WizardForm, type WizardFormat } from "./WizardForm";
  import { extractTextFromFile } from "@/features/resume-analyzer/lib/extractText";
  import type { ResumeAnswers } from "../formats/types";

  export function ResumeWizardEntry({ format }: { format: WizardFormat }) {
    const [initialAnswers, setInitialAnswers] = useState<ResumeAnswers | undefined>(undefined);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      try {
        const resumeText = await extractTextFromFile(file);
        const res = await fetch("/api/resumes/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't read that resume.");
          return;
        }
        setInitialAnswers(data.answers as ResumeAnswers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't read that file.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Have a resume already?</p>
              <p className="text-xs text-slate-500">
                Upload it (PDF, DOCX, or TXT) and we&rsquo;ll fill this template in for you — you can review and
                edit everything before saving.
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="upload-existing-resume"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploading}
                onClick={() => document.getElementById("upload-existing-resume")?.click()}
              >
                {uploading ? "Reading…" : "Upload resume"}
              </Button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <WizardForm key={initialAnswers ? "prefilled" : "blank"} format={format} initialAnswers={initialAnswers} />
      </div>
    );
  }
  ```

  Note: the `key` prop on `WizardForm` is what makes this work — `WizardForm`'s internal `answers` state is only initialized once (`useState(() => initialAnswers ?? emptyAnswers(...))`), so simply changing the `initialAnswers` prop after mount would not reset it. Changing `key` forces React to unmount and remount `WizardForm` with fresh state once parsing completes.

- [ ] **Step 2: Replace `src/app/(customer)/resume-builder/[format]/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { getResumeFormat } from "@/features/resume-builder/formats";
  import { ResumeWizardEntry } from "@/features/resume-builder/components/ResumeWizardEntry";
  import { AppErrorBoundary } from "@/components/AppErrorBoundary";

  export default async function WizardPage({ params }: { params: Promise<{ format: string }> }) {
    const { format: formatId } = await params;
    const format = getResumeFormat(formatId);
    if (!format) notFound();

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{format.name} resume</h1>
          <p className="mt-1 text-slate-600">Fill in what you have — you can edit everything after this too.</p>
        </div>
        <AppErrorBoundary scope="resume-builder:wizard">
          <ResumeWizardEntry format={{ id: format.id, name: format.name, sections: format.sections }} />
        </AppErrorBoundary>
      </div>
    );
  }
  ```

- [ ] **Step 3: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/resume-builder/components/ResumeWizardEntry.tsx "src/app/(customer)/resume-builder/[format]/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add upload-and-convert entry point to the resume wizard

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Template switching (known and retired-template cases)

**Files:**
- Modify: `src/app/api/resumes/[id]/route.ts`
- Create: `src/features/resume-builder/components/TemplateSwitcher.tsx`
- Modify: `src/app/(customer)/resume-builder/edit/[id]/page.tsx`

**Interfaces:**
- Consumes: `getResumeFormat`, `resumeFormats` (Task 4), `SelectField`, `Button` (existing).
- Produces: `PATCH /api/resumes/[id]` gains an optional `format` field in its accepted body — when present and different from the resume's current format, the route re-renders `fieldsJson` through the new format and updates `htmlContent` alongside `format` in one write. `TemplateSwitcher({ resumeId, currentFormatId, formats })` where `currentFormatId: string | null` (`null` signals "no valid current template" — the retired-format case) — this task's only consumer is the edit page, but the component is self-contained.

- [ ] **Step 1: Modify `src/app/api/resumes/[id]/route.ts`**

  Change the `updateSchema` from:
  ```typescript
  const updateSchema = z.object({
    htmlContent: z.string().optional(),
    title: z.string().trim().min(1).max(150).optional(),
    status: z.enum(["DRAFT", "FINAL"]).optional(),
  });
  ```
  to:
  ```typescript
  const updateSchema = z.object({
    htmlContent: z.string().optional(),
    title: z.string().trim().min(1).max(150).optional(),
    status: z.enum(["DRAFT", "FINAL"]).optional(),
    format: z.string().optional(),
  });
  ```

  Add this import at the top of the file, alongside the existing imports:
  ```typescript
  import { getResumeFormat } from "@/features/resume-builder/formats";
  ```

  Then change the body of the `PATCH` handler from:
  ```typescript
  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedResume(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    try {
      const body = await request.json();
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const resume = await db.resume.update({ where: { id }, data: parsed.data });
      logger.info("resume-builder", "Resume updated", { resumeId: id, userId: session.userId });
      return NextResponse.json({ resume });
    } catch (error) {
      logger.error("resume-builder", "Update resume failed", { resumeId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
    }
  }
  ```
  to:
  ```typescript
  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedResume(id, session.userId);
    if (!existing) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    try {
      const body = await request.json();
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }

      const data: { htmlContent?: string; title?: string; status?: string; format?: string } = {
        ...parsed.data,
      };

      // Switching to a different template re-renders the stored answers
      // through the new template's render() — this always wins over any
      // htmlContent the client also sent, since it's the authoritative
      // "re-derive from source" action. No current caller sends both in
      // the same request.
      if (parsed.data.format && parsed.data.format !== existing.format) {
        const newFormat = getResumeFormat(parsed.data.format);
        if (!newFormat) {
          return NextResponse.json({ error: "Unknown resume format" }, { status: 400 });
        }
        const answers = JSON.parse(existing.fieldsJson) as Parameters<typeof newFormat.render>[0];
        data.htmlContent = newFormat.render(answers);
      }

      const resume = await db.resume.update({ where: { id }, data });
      logger.info("resume-builder", "Resume updated", { resumeId: id, userId: session.userId });
      return NextResponse.json({ resume });
    } catch (error) {
      logger.error("resume-builder", "Update resume failed", { resumeId: id, error: String(error) });
      return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
    }
  }
  ```

  (The `GET` and `DELETE` handlers in this file, and the `loadOwnedResume` helper, are unchanged.)

- [ ] **Step 2: Create `src/features/resume-builder/components/TemplateSwitcher.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { Button } from "@/components/ui/Button";
  import { SelectField } from "@/components/ui/Field";

  export function TemplateSwitcher({
    resumeId,
    currentFormatId,
    formats,
  }: {
    resumeId: string;
    currentFormatId: string | null;
    formats: { id: string; name: string }[];
  }) {
    const router = useRouter();
    const [selected, setSelected] = useState(currentFormatId ?? formats[0]?.id ?? "");
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isNoOp = currentFormatId !== null && selected === currentFormatId;

    async function applySwitch() {
      if (isNoOp) return;
      if (
        currentFormatId !== null &&
        !confirm(
          "Switching templates re-renders your resume from your saved answers and will discard any manual edits you've made to the layout since you last saved. Continue?"
        )
      ) {
        setSelected(currentFormatId);
        return;
      }

      setSwitching(true);
      setError(null);
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: selected }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't switch templates");
          if (currentFormatId !== null) setSelected(currentFormatId);
          return;
        }
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
        if (currentFormatId !== null) setSelected(currentFormatId);
      } finally {
        setSwitching(false);
      }
    }

    return (
      <div className="no-print flex items-end gap-3">
        <div className="w-56">
          <SelectField
            label="Template"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            options={formats.map((f) => ({ value: f.id, label: f.name }))}
          />
        </div>
        <Button variant="secondary" onClick={applySwitch} disabled={switching || isNoOp}>
          {switching ? "Switching…" : "Change template"}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
  ```

  Note the `no-print` class on the root `div` — this matches the existing convention in `ResumeEditor.tsx` (its own toolbar uses the same class) for hiding UI chrome from the browser's print-to-PDF export.

- [ ] **Step 3: Replace `src/app/(customer)/resume-builder/edit/[id]/page.tsx`**

  ```tsx
  import { notFound } from "next/navigation";
  import { requireUser } from "@/features/auth/lib/guard";
  import { db } from "@/lib/db";
  import { getResumeFormat, resumeFormats } from "@/features/resume-builder/formats";
  import { ResumeEditor } from "@/features/resume-builder/components/ResumeEditor";
  import { TemplateSwitcher } from "@/features/resume-builder/components/TemplateSwitcher";
  import { AppErrorBoundary } from "@/components/AppErrorBoundary";

  export default async function EditResumePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await requireUser();
    const { id } = await params;

    const resume = await db.resume.findUnique({ where: { id } });
    if (!resume || resume.userId !== session.userId) notFound();

    const format = getResumeFormat(resume.format);
    const formatOptions = resumeFormats.map((f) => ({ id: f.id, name: f.name }));

    if (!format) {
      return (
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-700">This resume was built with a retired template.</p>
            <p className="mt-1 text-sm text-slate-500">
              Pick a new template below to keep editing &ldquo;{resume.title}&rdquo; — your saved answers carry
              over.
            </p>
          </div>
          <TemplateSwitcher resumeId={resume.id} currentFormatId={null} formats={formatOptions} />
        </div>
      );
    }

    return (
      <AppErrorBoundary scope="resume-builder:editor">
        <div className="flex flex-col gap-4">
          <TemplateSwitcher resumeId={resume.id} currentFormatId={resume.format} formats={formatOptions} />
          <ResumeEditor resumeId={resume.id} title={resume.title} initialHtml={resume.htmlContent} />
        </div>
      </AppErrorBoundary>
    );
  }
  ```

- [ ] **Step 4: Type-check and lint**

  Run: `npx tsc --noEmit && npm run lint`
  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add "src/app/api/resumes/[id]/route.ts" src/features/resume-builder/components/TemplateSwitcher.tsx "src/app/(customer)/resume-builder/edit/[id]/page.tsx"
  git commit -m "$(cat <<'EOF'
  Add template switching, including a retired-template fallback

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: Final verification

**Files:** none (verification only).

**Interfaces:** none — this task consumes everything built in Tasks 1–7 as a whole.

- [ ] **Step 1: Full lint**

  Run: `npm run lint`
  Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 2: Full production build**

  Check first: `ps aux | grep "next dev" | grep -v grep`. If a `next dev` process is running **in this exact checkout** (confirm via `lsof -p <pid> | grep cwd`), do not run `rm -rf .next` — either ask whoever is running it to stop it first, or run `npx tsc --noEmit` instead of a full build (type-checking is safe to run alongside a live dev server; deleting `.next` is not).

  Otherwise:
  ```bash
  rm -rf .next && npm run build
  ```
  Expected: `✓ Compiled successfully`, and the route table includes `/resume-builder`, `/resume-builder/[format]`, `/resume-builder/edit/[id]`, `/api/resumes/photo`, `/api/resumes/parse`.

- [ ] **Step 3: Manual browser smoke test**

  Requires a CUSTOMER-role account signed in — do not create a new account to do this (that means entering a password, off-limits for an agent to do on the user's behalf); ask the project owner to run this checklist, or run it yourself only if you already have such an account available:

  1. Go to `/resume-builder` — confirm exactly 5 templates are listed (Minimalist, Executive, Elegant, Coastal, Professional), no Classic/Modern.
  2. Pick a template with a photo (e.g. Executive). Fill in the wizard, including uploading a photo in the personal-details section — confirm a preview thumbnail appears after upload, and the "Skip / no photo" path (leaving it blank) also works.
  3. Add at least one language entry. Save the resume — confirm it redirects to the editor and the photo/languages render correctly in the chosen template's layout.
  4. On a different template's wizard page, click "Upload resume", pick a real resume file (PDF or DOCX) — confirm the wizard pre-fills with extracted data you can then edit before saving.
  5. On the editor page for a saved resume, use "Change template" to switch to a different template — confirm the confirmation dialog appears, and after confirming, the resume re-renders in the new template with the same data (including photo/languages if present).
  6. Confirm DOCX export (`ExportButtons`) and print-to-PDF (`window.print()`) both still work on a resume built with one of the new templates.
  7. As a COMPANY account (from the job-postings feature), open an applicant who used one of the new templates from `/company/jobs/[id]/applicants` — confirm the sandboxed-iframe preview still renders it correctly (inline styles, no broken layout).
