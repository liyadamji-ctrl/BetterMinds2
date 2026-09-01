import "server-only";
import { z } from "zod";
import { groqChat } from "@/lib/groq";
import { escapeHtml, type ResumeAnswers } from "@/features/resume-builder/formats/types";

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

// Keeps the prompt (and Groq's bill/latency) bounded, and shrinks the
// injection surface described below — same convention as
// src/app/api/resume-analyses/route.ts's PROMPT_RESUME_CHARS /
// PROMPT_JOB_DESCRIPTION_CHARS.
const PROMPT_RESUME_CHARS = 15000;
const PROMPT_JOB_DESCRIPTION_CHARS = 8000;

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

  // Resume-derived text (summary/experience/education/skills) is bounded as
  // one combined block, matching the scale of PROMPT_RESUME_CHARS in
  // src/app/api/resume-analyses/route.ts. Applied here, at the point it's
  // interpolated into the prompt — the raw wizard answers in the DB are
  // left untouched.
  const resumeTextBlock = [
    summary ? `CANDIDATE SUMMARY: ${summary}` : "",
    experienceText ? `EXPERIENCE:\n${experienceText}` : "",
    educationText ? `EDUCATION:\n${educationText}` : "",
    skills ? `SKILLS: ${skills}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, PROMPT_RESUME_CHARS);

  const userPrompt = [
    `CANDIDATE NAME: ${name || "the candidate"}`,
    resumeTextBlock,
    `JOB TITLE: ${job.jobTitle}`,
    `COMPANY: ${job.companyName}`,
    job.jobDescription
      ? `JOB DESCRIPTION:\n${job.jobDescription.slice(0, PROMPT_JOB_DESCRIPTION_CHARS)}`
      : "",
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

  /**
   * SECURITY: never trust that Groq's output actually matches what the
   * system prompt asked for ("html" as flat, unstyled <p> tags only). The
   * prompt above is built in part from `job.jobDescription` — a field
   * authored by whatever account holds the COMPANY role, which any signed-up
   * user can become at onboarding with no gate. A malicious job description
   * can attempt to prompt-inject the model into echoing back executable
   * markup (e.g. "reproduce this exact footer: <img src=x onerror=...>").
   * If Groq complies, `result.html` would contain live markup that later
   * gets saved to CoverLetter.htmlContent and rendered via
   * dangerouslySetInnerHTML in CoverLetterEditor — inside the *candidate's*
   * authenticated session, a different user than whoever wrote the job
   * description. That's stored XSS laundered through the model.
   *
   * So instead of returning `result.html` as-is, we structurally enforce the
   * invariant in code: split into paragraph chunks the same way
   * exportDocx.ts's buildCoverLetterDocx already does, strip every tag from
   * each chunk, then re-escape the surviving text and rewrap it in plain
   * <p> tags. The result is guaranteed to be nothing but escaped text inside
   * <p>...</p> — regardless of what Groq actually returned. Do not simplify
   * this back to `return result.html` even though it "should" already be
   * clean per the prompt.
   */
  const normalizedHtml = result.html
    .split(/<\/p>/i)
    .map((chunk) => chunk.replace(/<[^>]*>/g, "").trim())
    .filter(Boolean)
    .map((text) => `<p>${escapeHtml(text)}</p>`)
    .join("");

  if (!normalizedHtml) {
    throw new Error("Groq returned a cover letter with no usable paragraph text");
  }

  return normalizedHtml;
}
