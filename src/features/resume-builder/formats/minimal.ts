import { type ResumeFormat, escapeHtml } from "./types";
import { bulletList, contactParts, items, standardSections, str } from "./shared";

export const minimalFormat: ResumeFormat = {
  id: "minimal",
  name: "Minimal",
  description: "Left-aligned, lots of white space and no colour — easy for any applicant tracking system to read.",
  sections: standardSections,
  render(answers) {
    const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
    const contactLine = contactParts(answers).map(escapeHtml).join(" / ");
    const summary = escapeHtml(str(answers, "summary", "summary"));

    const experience = items(answers, "experience")
      .map(
        (item) => `
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <span style="font-weight:600;">${escapeHtml(item.role ?? "")}, ${escapeHtml(item.company ?? "")}</span>
            <span style="color:#666; white-space:nowrap;">${escapeHtml(item.dates ?? "")}</span>
          </div>
          ${bulletList(item.description ?? "")}
        </div>`
      )
      .join("");

    const education = items(answers, "education")
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px;">
          <span>${escapeHtml(item.school ?? "")}${item.degree ? ", " + escapeHtml(item.degree) : ""}</span>
          <span style="color:#666; white-space:nowrap;">${escapeHtml(item.dates ?? "")}</span>
        </div>`
      )
      .join("");

    const skills = escapeHtml(str(answers, "skills", "skills"));

    const section = (title: string, body: string) =>
      body
        ? `<div style="margin-bottom:22px;"><h2 style="font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:#666; margin:0 0 8px;">${title}</h2>${body}</div>`
        : "";

    return `
      <div style="font-family: Helvetica, Arial, sans-serif; color:#222; max-width:700px; font-size:13px; line-height:1.5;">
        <h1 style="font-size:30px; font-weight:300; margin:0 0 4px;">${name}</h1>
        <p style="color:#666; margin:0 0 26px;">${contactLine}</p>
        ${section("Summary", summary ? `<p style="margin:0;">${summary}</p>` : "")}
        ${section("Experience", experience)}
        ${section("Education", education)}
        ${section("Skills", skills ? `<p style="margin:0;">${skills}</p>` : "")}
      </div>
    `;
  },
};
