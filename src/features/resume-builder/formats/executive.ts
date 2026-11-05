import { type ResumeFormat, escapeHtml } from "./types";
import { bulletList, contactParts, items, splitSkills, standardSections, str } from "./shared";

const NAVY = "#1f2a44";

export const executiveFormat: ResumeFormat = {
  id: "executive",
  name: "Executive",
  description: "Serif headings, navy divider lines and bullet-point achievements. Best for experienced professionals.",
  sections: standardSections,
  render(answers) {
    const name = escapeHtml(str(answers, "personal", "fullName") || "Your Name");
    const contactLine = contactParts(answers).map(escapeHtml).join(" &nbsp;|&nbsp; ");
    const summary = escapeHtml(str(answers, "summary", "summary"));

    const experience = items(answers, "experience")
      .map(
        (item) => `
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <span style="font-weight:700;">${escapeHtml(item.company ?? "")}</span>
            <span style="font-style:italic;">${escapeHtml(item.dates ?? "")}</span>
          </div>
          <div style="font-style:italic; color:#444;">${escapeHtml(item.role ?? "")}</div>
          ${bulletList(item.description ?? "")}
        </div>`
      )
      .join("");

    const education = items(answers, "education")
      .map(
        (item) => `
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px;">
          <span><strong>${escapeHtml(item.school ?? "")}</strong>${item.degree ? ", " + escapeHtml(item.degree) : ""}</span>
          <span style="font-style:italic;">${escapeHtml(item.dates ?? "")}</span>
        </div>`
      )
      .join("");

    const skills = splitSkills(str(answers, "skills", "skills")).map(escapeHtml).join(" &middot; ");

    const section = (title: string, body: string) =>
      body
        ? `<div style="margin-bottom:18px;"><h2 style="font-size:15px; font-variant:small-caps; letter-spacing:1px; color:${NAVY}; border-bottom:2px solid ${NAVY}; padding-bottom:2px; margin:0 0 8px;">${title}</h2>${body}</div>`
        : "";

    return `
      <div style="font-family: Georgia, 'Times New Roman', serif; color:#1a1a1a; max-width:700px; font-size:13px; line-height:1.45;">
        <div style="border-top:6px solid ${NAVY}; padding-top:14px; margin-bottom:18px;">
          <h1 style="font-size:28px; color:${NAVY}; margin:0 0 4px;">${name}</h1>
          <p style="font-size:12px; margin:0;">${contactLine}</p>
        </div>
        ${section("Professional Summary", summary ? `<p style="margin:0;">${summary}</p>` : "")}
        ${section("Experience", experience)}
        ${section("Education", education)}
        ${section("Core Skills", skills ? `<p style="margin:0;">${skills}</p>` : "")}
      </div>
    `;
  },
};
