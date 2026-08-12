import { type ResumeAnswers, type ResumeFormat, escapeHtml } from "./types";

function str(answers: ResumeAnswers, section: string, field: string): string {
  const value = answers[section];
  if (!value || Array.isArray(value)) return "";
  return value[field] ?? "";
}

function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
  const value = answers[section];
  return Array.isArray(value) ? value : [];
}

export const classicFormat: ResumeFormat = {
  id: "classic",
  name: "Classic",
  description: "A plain, serif, black-and-white layout — the traditional academic/LaTeX resume look.",
  sections: [
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
  ],
  render(answers) {
    const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
    const contactLine = [
      str(answers, "personal", "email"),
      str(answers, "personal", "phone"),
      str(answers, "personal", "location"),
      str(answers, "personal", "linkedin"),
    ]
      .filter(Boolean)
      .map(escapeHtml)
      .join(" &nbsp;|&nbsp; ");

    const summary = escapeHtml(str(answers, "summary", "summary"));

    const experienceHtml = items(answers, "experience")
      .map(
        (item) => `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-weight:bold;">
            <span>${escapeHtml(item.role ?? "")}, ${escapeHtml(item.company ?? "")}</span>
            <span>${escapeHtml(item.dates ?? "")}</span>
          </div>
          <div style="white-space:pre-line;">${escapeHtml(item.description ?? "")}</div>
        </div>`
      )
      .join("");

    const educationHtml = items(answers, "education")
      .map(
        (item) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span>${escapeHtml(item.school ?? "")}${item.degree ? ", " + escapeHtml(item.degree) : ""}</span>
          <span>${escapeHtml(item.dates ?? "")}</span>
        </div>`
      )
      .join("");

    const skills = escapeHtml(str(answers, "skills", "skills"));

    return `
      <div style="font-family: Georgia, 'Times New Roman', serif; color:#111; max-width:700px;">
        <h1 style="text-align:center; font-size:24px; margin:0 0 4px;">${name}</h1>
        <p style="text-align:center; font-size:13px; margin:0 0 18px;">${contactLine}</p>

        ${summary ? section("Summary", `<p>${summary}</p>`) : ""}
        ${experienceHtml ? section("Experience", experienceHtml) : ""}
        ${educationHtml ? section("Education", educationHtml) : ""}
        ${skills ? section("Skills", `<p>${skills}</p>`) : ""}
      </div>
    `;
  },
};

function section(title: string, bodyHtml: string): string {
  return `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #111; padding-bottom:2px; margin:0 0 8px;">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}
