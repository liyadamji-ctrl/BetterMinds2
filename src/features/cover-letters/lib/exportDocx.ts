import { Document, Packer, Paragraph } from "docx";

/**
 * Reverse of `escapeHtml()` in `src/features/resume-builder/formats/types.ts`.
 * A contentEditable element's `innerHTML` always encodes `&`, `<`, `>` in
 * text nodes (and browsers sometimes insert `&nbsp;` for spacing), so this
 * decodes the same set back to plain characters. `&amp;` must be decoded
 * last: decoding it first would turn a literal "&lt;" typed as text (encoded
 * by the browser as "&amp;lt;") into "&lt;", which the next step would then
 * wrongly decode into "<".
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * A cover letter's htmlContent is always a flat sequence of <p> tags (see
 * generate.ts's prompt) — no nested sections like a resume — so this just
 * splits on </p> and strips any remaining tags into plain-text docx
 * Paragraphs. Tag-stripping (not just splitting) also makes this safe
 * against whatever markup a user's manual contentEditable edits produce.
 * Stripped text is then run through decodeHtmlEntities() so entities the
 * browser encoded (e.g. "&amp;" for "&") render as the intended characters.
 */
export async function buildCoverLetterDocx(htmlContent: string, title: string): Promise<Buffer> {
  const paragraphTexts = htmlContent
    .split(/<\/p>/i)
    .map((chunk) => decodeHtmlEntities(chunk.replace(/<[^>]*>/g, "").trim()))
    .filter(Boolean);

  const children =
    paragraphTexts.length > 0
      ? paragraphTexts.map((text) => new Paragraph({ text, spacing: { after: 200 } }))
      : [new Paragraph({ text: title })];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
