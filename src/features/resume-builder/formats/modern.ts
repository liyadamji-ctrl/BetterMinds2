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

const ACCENT = "#4338ca";

export const modernFormat: ResumeFormat = {
  id: "modern",
  name: "Modern",
  description: "Sans-serif with a colored header — a cleaner, more visual layout.",
  // Same section shape as Classic on purpose: two formats can share a
  // wizard schema and only differ in how render() lays the answers out.
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
      .join(" &nbsp;•&nbsp; ");

    const summary = escapeHtml(str(answers, "summary", "summary"));

    const experienceHtml = items(answers, "experience")
      .map(
        (item) => `
        <div style="margin-bottom:12px;">
          <div style="font-weight:600; color:${ACCENT};">${escapeHtml(item.role ?? "")}</div>
          <div style="display:flex;justify-content:space-between; font-size:13px; color:#555;">
            <span>${escapeHtml(item.company ?? "")}</span>
            <span>${escapeHtml(item.dates ?? "")}</span>
          </div>
          <div style="white-space:pre-line; margin-top:4px;">${escapeHtml(item.description ?? "")}</div>
        </div>`
      )
      .join("");

    const educationHtml = items(answers, "education")
      .map(
        (item) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span><strong>${escapeHtml(item.school ?? "")}</strong>${item.degree ? " — " + escapeHtml(item.degree) : ""}</span>
          <span style="color:#555;">${escapeHtml(item.dates ?? "")}</span>
        </div>`
      )
      .join("");

    const skills = items0(str(answers, "skills", "skills"));

    return `
      <div style="font-family: -apple-system, 'Segoe UI', sans-serif; color:#1a1a1a; max-width:700px;">
        <div style="background:${ACCENT}; color:white; padding:24px; border-radius:6px 6px 0 0;">
          <h1 style="font-size:26px; margin:0 0 6px;">${name}</h1>
          <p style="font-size:13px; margin:0; opacity:0.9;">${contactLine}</p>
        </div>
        <div style="border:1px solid #e5e7eb; border-top:none; padding:20px; border-radius:0 0 6px 6px;">
          ${summary ? section("Summary", `<p>${summary}</p>`) : ""}
          ${experienceHtml ? section("Experience", experienceHtml) : ""}
          ${educationHtml ? section("Education", educationHtml) : ""}
          ${skills ? section("Skills", skills) : ""}
        </div>
      </div>
    `;
  },
};

function items0(csv: string): string {
  const parts = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return `<div style="display:flex; flex-wrap:wrap; gap:6px;">${parts
    .map(
      (p) =>
        `<span style="background:#eef2ff; color:${ACCENT}; font-size:12px; padding:3px 10px; border-radius:999px;">${escapeHtml(p)}</span>`
    )
    .join("")}</div>`;
}

function section(title: string, bodyHtml: string): string {
  return `
    <div style="margin-bottom:16px;">
      <h2 style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${ACCENT}; margin:0 0 8px;">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}
