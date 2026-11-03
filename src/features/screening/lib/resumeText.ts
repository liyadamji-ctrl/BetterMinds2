import "server-only";

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Resumes are stored as rendered HTML — flatten to readable plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Removes contact details before the text is sent to Groq, so screening
 * judges skills and experience rather than who the person is: the
 * applicant's own name and email, plus any email address, phone number or
 * URL that appears in the resume.
 */
export function anonymizeResumeText(
  text: string,
  applicant: { name: string | null; email: string }
): string {
  let out = text;
  const names = [applicant.name, applicant.email]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v && v.length > 1);
  for (const value of names) {
    out = out.replace(new RegExp(escapeRegExp(value), "gi"), "[redacted]");
  }
  return out
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/(https?:\/\/|www\.|(linkedin|github)\.com)\S*/gi, "[link]")
    // 10+ digits, so date ranges like "2019 - 2023" are left alone.
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[phone]" : m));
}
