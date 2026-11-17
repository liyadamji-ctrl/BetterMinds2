export type SimpleField = {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  /** Short guidance shown under the label, e.g. what to write here. */
  hint?: string;
  required?: boolean;
};

/**
 * The summary box, shared by every format. People often don't know what to
 * put here, so it carries a tip and an example.
 */
export const SUMMARY_FIELD: SimpleField = {
  id: "summary",
  label: "Summary",
  type: "textarea",
  hint: "Write 2–3 sentences: who you are, the kind of role you're aiming for, and one strength. Keep it short and specific.",
  placeholder:
    "Example: Marketing student at Northeastern with two internships in social media. Looking for a marketing internship where I can grow my content skills. Strong at turning data into clear campaign ideas.",
};

export type SimpleSection = {
  id: string;
  kind: "simple";
  title: string;
  fields: SimpleField[];
};

/** A section the user can add multiple entries to — e.g. one per job. */
export type RepeatableSection = {
  id: string;
  kind: "repeatable";
  title: string;
  addLabel: string;
  itemFields: SimpleField[];
};

export type ResumeSection = SimpleSection | RepeatableSection;

/**
 * Wizard answers, keyed by section id. Simple sections store an object of
 * `{ [fieldId]: value }`; repeatable sections store an array of those.
 */
export type ResumeAnswers = Record<string, Record<string, string> | Array<Record<string, string>>>;

export type ResumeFormat = {
  id: string;
  name: string;
  description: string;
  sections: ResumeSection[];
  /** Turns wizard answers into the HTML shown in the editor and exported. */
  render: (answers: ResumeAnswers) => string;
};

export function emptyAnswers(sections: ResumeSection[]): ResumeAnswers {
  const answers: ResumeAnswers = {};
  for (const section of sections) {
    answers[section.id] = section.kind === "repeatable" ? [] : {};
  }
  return answers;
}

/** Escapes user text before it goes into an HTML template string. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
