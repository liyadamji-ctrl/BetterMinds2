import { Document, Packer, Paragraph } from "docx";

/**
 * A cover letter's htmlContent is always a flat sequence of <p> tags (see
 * generate.ts's prompt) — no nested sections like a resume — so this just
 * splits on </p> and strips any remaining tags into plain-text docx
 * Paragraphs. Tag-stripping (not just splitting) also makes this safe
 * against whatever markup a user's manual contentEditable edits produce.
 */
export async function buildCoverLetterDocx(htmlContent: string, title: string): Promise<Buffer> {
  const paragraphTexts = htmlContent
    .split(/<\/p>/i)
    .map((chunk) => chunk.replace(/<[^>]*>/g, "").trim())
    .filter(Boolean);

  const children =
    paragraphTexts.length > 0
      ? paragraphTexts.map((text) => new Paragraph({ text, spacing: { after: 200 } }))
      : [new Paragraph({ text: title })];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
