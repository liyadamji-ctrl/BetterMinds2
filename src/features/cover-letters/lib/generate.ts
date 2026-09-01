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
