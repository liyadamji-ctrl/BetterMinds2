import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { ResumeAnswers } from "../formats/types";

function str(answers: ResumeAnswers, section: string, field: string): string {
  const value = answers[section];
  if (!value || Array.isArray(value)) return "";
  return value[field] ?? "";
}

function items(answers: ResumeAnswers, section: string): Array<Record<string, string>> {
  const value = answers[section];
  return Array.isArray(value) ? value : [];
}

/**
 * Builds a .docx directly from the wizard answers (not from the preview
 * HTML) so the export never depends on a headless browser or any paid
 * conversion service — the `docx` package writes the file format itself.
 *
 * This assumes the common section shape (personal / summary / experience /
 * education / skills) that classic.ts and modern.ts both use. A format with
 * a different shape would need its own export function alongside its own
 * render() — see formats/index.ts for the pattern.
 */
export async function buildResumeDocx(answers: ResumeAnswers, title: string): Promise<Buffer> {
  const name = str(answers, "personal", "fullName") || title;
  const contact = [
    str(answers, "personal", "email"),
    str(answers, "personal", "phone"),
    str(answers, "personal", "location"),
    str(answers, "personal", "linkedin"),
  ]
    .filter(Boolean)
    .join("  |  ");

  const children: Paragraph[] = [
    new Paragraph({ text: name, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: contact, spacing: { after: 200 } }),
  ];

  const summary = str(answers, "summary", "summary");
  if (summary) {
    children.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: summary, spacing: { after: 200 } }));
  }

  const experience = items(answers, "experience");
  if (experience.length) {
    children.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2 }));
    for (const item of experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${item.role ?? ""}, ${item.company ?? ""}`, bold: true }),
            new TextRun({ text: item.dates ? `   (${item.dates})` : "", italics: true }),
          ],
        })
      );
      if (item.description) {
        children.push(new Paragraph({ text: item.description, spacing: { after: 150 } }));
      }
    }
  }

  const education = items(answers, "education");
  if (education.length) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2 }));
    for (const item of education) {
      children.push(
        new Paragraph({
          text: `${item.school ?? ""}${item.degree ? ", " + item.degree : ""}${item.dates ? "   (" + item.dates + ")" : ""}`,
        })
      );
    }
  }

  const skills = str(answers, "skills", "skills");
  if (skills) {
    children.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
    children.push(new Paragraph({ text: skills }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
