export type SimpleField = {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  placeholder?: string;
  required?: boolean;
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
