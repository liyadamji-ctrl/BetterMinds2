import { type ResumeAnswers, type ResumeSection, escapeHtml } from "./types";

/**
 * The common wizard schema (personal / summary / experience / education /
 * skills). The docx export, cover letters and the CV-to-resume mapper all
 * assume this exact shape, so any new format should reuse it and only differ
 * in render().
 */
export const standardSections: ResumeSection[] = [
  {
    id: "personal",
    kind: "simple",
    title: "Contact Information",
    fields: [
      { id: "fullName", label: "Full Name", type: "text", required: true },
      { id: "email", label: "Email", type: "email", required: true },
      { id: "phone", label: "Phone", type: "tel" },
      { id: "location", label: "Location", type: "text", placeholder: "City, Country" },
      { id: "linkedin", label: "LinkedIn / Portfolio URL", type: "text" },
    ],
  },
  {
    id: "summary",
    kind: "simple",
    title: "Summary",
    fields: [{ id: "summary", label: "2–3 Sentence Summary", type: "textarea" }],
  },
  {
    id: "experience",
    kind: "repeatable",
    title: "Experience",
    addLabel: "Add Another Experience",
    itemFields: [
      { id: "role", label: "Job Title", type: "text", required: true },
      { id: "company", label: "Company", type: "text", required: true },
      { id: "dates", label: "Dates", type: "text", placeholder: "Jun 2024 – Present" },
      { id: "description", label: "What did you do?", type: "textarea" },
    ],
  },
  {
    id: "education",
    kind: "repeatable",
    title: "Education",
    addLabel: "Add Another School",
    itemFields: [
      { id: "school", label: "School", type: "text", required: true },
      { id: "degree", label: "Degree / Field", type: "text" },
      { id: "dates", label: "Dates", type: "text", placeholder: "2022 – 2026" },
    ],
  },
  {
    id: "skills",
    kind: "simple",
    title: "Skills",
    fields: [{ id: "skills", label: "Skills (comma-separated)", type: "textarea" }],
  },
];

export function str(answers: ResumeAnswers, section: string, field: string): string {
  const value = answers[section];
  if (!value || Array.isArray(value)) return "";
  return value[field] ?? "";
}

export function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
  const value = answers[section];
  return Array.isArray(value) ? value : [];
}

export function contactParts(answers: ResumeAnswers): string[] {
  return [
    str(answers, "personal", "email"),
    str(answers, "personal", "phone"),
    str(answers, "personal", "location"),
    str(answers, "personal", "linkedin"),
  ].filter(Boolean);
}

export function splitSkills(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One <li> per non-empty line, leading bullet characters stripped. */
export function bulletList(text: string, style = ""): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-–*]+/, "").trim())
    .filter(Boolean);
  if (!lines.length) return "";
  return `<ul style="margin:4px 0 0; padding-left:18px; ${style}">${lines
    .map((l) => `<li style="margin-bottom:2px;">${escapeHtml(l)}</li>`)
    .join("")}</ul>`;
}
