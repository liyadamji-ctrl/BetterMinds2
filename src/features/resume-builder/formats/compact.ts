import { type ResumeFormat, escapeHtml } from "./types";
import { bulletList, contactParts, items, splitSkills, standardSections, str } from "./shared";

const SIDEBAR = "#1e293b";

export const compactFormat: ResumeFormat = {
  id: "compact",
  name: "Compact Sidebar",
  description: "Two columns: a dark sidebar with contact, skills and education, and your experience on the right.",
  sections: standardSections,
  render(answers) {
    const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
    const summary = escapeHtml(str(answers, "summary", "summary"));

    const contact = contactParts(answers)
      .map((c) => `<div style="margin-bottom:6px; word-break:break-word;">${escapeHtml(c)}</div>`)
      .join("");

    const skills = splitSkills(str(answers, "skills", "skills"))
      .map((s) => `<div style="margin-bottom:4px;">${escapeHtml(s)}</div>`)
      .join("");

    const education = items(answers, "education")
      .map(
        (item) => `
        <div style="margin-bottom:10px;">
          <div style="font-weight:600;">${escapeHtml(item.school ?? "")}</div>
          ${item.degree ? `<div>${escapeHtml(item.degree)}</div>` : ""}
          ${item.dates ? `<div style="opacity:0.75;">${escapeHtml(item.dates)}</div>` : ""}
        </div>`
      )
      .join("");

    const experience = items(answers, "experience")
      .map(
        (item) => `
        <div style="margin-bottom:14px;">
          <div style="font-weight:700; font-size:14px;">${escapeHtml(item.role ?? "")}</div>
          <div style="font-size:12px; color:#555;">${escapeHtml(item.company ?? "")}${item.dates ? " · " + escapeHtml(item.dates) : ""}</div>
          ${bulletList(item.description ?? "", "font-size:13px;")}
        </div>`
      )
      .join("");

    const side = (title: string, body: string) =>
      body
        ? `<div style="margin-bottom:18px;"><h2 style="font-size:11px; letter-spacing:1.5px; text-transform:uppercase; margin:0 0 8px; opacity:0.8;">${title}</h2>${body}</div>`
        : "";
    const main = (title: string, body: string) =>
      body
        ? `<div style="margin-bottom:18px;"><h2 style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; border-bottom:2px solid ${SIDEBAR}; padding-bottom:3px; margin:0 0 8px;">${title}</h2>${body}</div>`
        : "";

    return `
      <div style="font-family: -apple-system, 'Segoe UI', sans-serif; color:#1a1a1a; max-width:720px; display:flex; border:1px solid #e5e7eb;">
        <div style="width:210px; background:${SIDEBAR}; color:white; padding:24px 18px; font-size:12px; flex-shrink:0;">
          ${side("Contact", contact)}
          ${side("Skills", skills)}
          ${side("Education", education)}
        </div>
        <div style="flex:1; padding:24px 22px; font-size:13px;">
          <h1 style="font-size:26px; margin:0 0 14px;">${name}</h1>
          ${main("Profile", summary ? `<p style="margin:0;">${summary}</p>` : "")}
          ${main("Experience", experience)}
        </div>
      </div>
    `;
  },
};
