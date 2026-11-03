/**
 * Turns the raw extracted resume text into something an admin can read, with
 * personal contact details removed. Pure functions, no DB.
 *
 * Why this is needed: the analyzer extracts text in the browser, and a PDF
 * comes back as one long run of words with no line breaks (DOCX/TXT keep
 * theirs). So we rebuild structure from the words themselves (section
 * headings, bullet glyphs) rather than trusting newlines.
 *
 * Redaction is best-effort, not a guarantee: it removes the owner's name,
 * emails, phone numbers, links, addresses and the "City, Country" style
 * location in the header, but free-text mentions elsewhere can slip through.
 */

export type ResumeOwner = {
  name: string | null;
  email: string;
  /** Free-text location the person gave during onboarding, if any. */
  location: string | null;
};

export type ResumeBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

export type ResumeSection = { heading: string | null; blocks: ResumeBlock[] };

export type FormattedResume = { sections: ResumeSection[]; redactions: number };

const HEADINGS = [
  "summary",
  "professional summary",
  "career summary",
  "profile",
  "professional profile",
  "objective",
  "career objective",
  "about me",
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "work history",
  "internships",
  "internship experience",
  "education",
  "academic background",
  "academic qualifications",
  "skills",
  "technical skills",
  "key skills",
  "core competencies",
  "projects",
  "academic projects",
  "personal projects",
  "certifications",
  "certificates",
  "licenses",
  "achievements",
  "accomplishments",
  "awards",
  "honors",
  "publications",
  "volunteer experience",
  "volunteering",
  "extracurricular activities",
  "activities",
  "leadership",
  "languages",
  "interests",
  "hobbies",
  "references",
];

const HEADING_SET = new Set(HEADINGS);

// Longest first so "WORK EXPERIENCE" wins over "EXPERIENCE".
const SORTED_HEADINGS = [...HEADINGS].sort((a, b) => b.length - a.length);
const HEADING_ALT = SORTED_HEADINGS.map((h) => h.replace(/ /g, "\\s+")).join("|");
const HEADING_ALT_UPPER = SORTED_HEADINGS.map((h) => h.toUpperCase().replace(/ /g, "\\s+")).join("|");

/** Bullet glyphs that start a list item. */
const BULLETS = "•▪●◦‣∙·■□▫➢➤✓✔";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

function isHeadingLine(line: string): boolean {
  const cleaned = line
    .replace(/[:\-–—|]+$/g, "")
    .replace(/^[#*\s]+/, "")
    .trim()
    .toLowerCase();
  return cleaned.length > 0 && cleaned.length <= 40 && HEADING_SET.has(cleaned);
}

/** Splits the text into the header (before the first section heading) and the rest. */
function splitHeader(text: string): { header: string; rest: string } {
  const lines = text.split("\n");
  // Multi-line text: the header ends at the first line that is a heading.
  if (lines.length > 4) {
    const idx = lines.findIndex((l) => isHeadingLine(l));
    if (idx > 0) return { header: lines.slice(0, idx).join("\n"), rest: lines.slice(idx).join("\n") };
  }
  // One long run of text: the header ends at the first ALL-CAPS heading.
  const upper = new RegExp(`\\s(?:${HEADING_ALT_UPPER})(?=\\s|:|$)`).exec(text);
  if (upper && upper.index > 0 && upper.index < 600) {
    return { header: text.slice(0, upper.index), rest: text.slice(upper.index) };
  }
  // No heading found: treat only the first few lines / 300 chars as the header.
  const cut = Math.min(300, lines.slice(0, 3).join("\n").length);
  return { header: text.slice(0, cut), rest: text.slice(cut) };
}

const NOT_A_NAME = new Set([
  "resume",
  "curriculum",
  "vitae",
  "cv",
  "email",
  "phone",
  "mobile",
  "contact",
  "address",
  "linkedin",
  "github",
  "portfolio",
  "location",
]);

function redactHeader(header: string, owner: ResumeOwner, count: { n: number }): string {
  let out = header;
  const hit = (token: string) => {
    count.n++;
    return token;
  };

  // Labelled contact fields. PDF text has no line breaks, so every value is
  // bounded: one token for email/phone, a short run that stops at the next
  // label for addresses, and one handle for social profiles.
  out = out.replace(
    /\b(email|e-mail|phone|mobile|mob|tel|contact)\s*[:\-–]\s*(?:\[[a-z]+\]|\+?[\d()\-\s.]{6,25}\d|\S+)/gi,
    (_m, label: string) => `${label}: ${hit("[removed]")}`
  );
  out = out.replace(
    /\b(address|location|city|based in)\s*[:\-–]\s*(?:(?!\b(?:email|e-mail|phone|mobile|linkedin|github|portfolio|website)\b)[^\n|•·]){2,50}/gi,
    (_m, label: string) => `${label}: ${hit("[removed]")}`
  );
  out = out.replace(
    /\b(linkedin|github|gitlab|portfolio|website|twitter|behance|leetcode|kaggle|medium)\s*[:\-–]\s*\S+/gi,
    (_m, label: string) => `${label}: ${hit("[link]")}`
  );
  out = out.replace(/\b(?:in|pub)\/[\w-]{5,}\/?/g, () => hit("[link]")); // linkedin.com/in/<handle> without the domain

  // Street addresses and postal codes.
  out = out.replace(
    /\b\d+[A-Za-z]?(?:[-/]\d+)?,?\s+[A-Za-z0-9 .'-]{2,40}\s(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|nagar|sector|block|colony|marg|drive|dr\.?|boulevard|blvd\.?)\b[^\n|•·]{0,40}/gi,
    () => hit("[address]")
  );
  out = out.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, () => hit("[postcode]")); // UK
  out = out.replace(/\b\d{5}(?:-\d{4})?\b|\b\d{6}\b/g, () => hit("[postcode]")); // US / India

  // "City, Country" or "City, State, Country" (1-3 capitalised words per part).
  // A place word is capitalised and is not a contact label ("India LinkedIn:").
  const W = "(?!(?:LinkedIn|GitHub|GitLab|Email|E-mail|Phone|Mobile|Portfolio|Website|Address|Location)\\b)[A-Z][a-zA-Z.'-]+";
  out = out.replace(
    new RegExp(`\\b${W}(?: ${W}){0,2}(?:, *${W}(?: ${W}){0,2}){1,2}\\b`, "g"),
    () => hit("[location]")
  );

  // The place the person gave during onboarding. Header only: the same city
  // can legitimately appear in the body as a school or employer.
  if (owner.location) {
    for (const part of owner.location.split(/[,/|;]/).map((p) => p.trim())) {
      if (part.length >= 3) out = out.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, "gi"), () => hit("[location]"));
    }
  }

  // The name: leading run of 2-4 capitalised (or ALL-CAPS) words.
  out = out.replace(
    /^\s*((?:[A-Z][a-zA-Z'’.-]+|[A-Z]{2,})(?: +(?:[A-Z][a-zA-Z'’.-]+|[A-Z]{2,})){1,3})(?=\s|$|[|•·,])/,
    (m, words: string) => {
      const lower = words.toLowerCase().split(/\s+/);
      if (lower.some((w) => NOT_A_NAME.has(w) || HEADING_SET.has(w))) return m;
      return m.replace(words, hit("[name]"));
    }
  );

  return out;
}

const PLACEHOLDER = "\\[(?:email|phone|link|removed|location|address|postcode|name)\\]";

/**
 * The header is only contact details plus a headline. Once the contact
 * details are gone, "Email: [removed] | [phone] | [link]" is just noise, so
 * drop the placeholders and keep the headline ("Undergraduate — Data Science").
 */
function stripHeaderPlaceholders(header: string): string {
  return header
    .replace(
      new RegExp(
        `\\b(?:email|e-mail|phone|mobile|mob|tel|contact|address|location|city|based in|linkedin|github|gitlab|portfolio|website|twitter|behance|leetcode|kaggle|medium)\\s*[:\\-–]?\\s*${PLACEHOLDER}`,
        "gi"
      ),
      ""
    )
    .replace(new RegExp(PLACEHOLDER, "g"), "")
    .replace(/(?:[ \t]*[|•·,][ \t]*){2,}/g, " | ") // separators left side by side
    .replace(/^[ \t|•·,]+|[ \t|•·,]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function redactResumeText(text: string, owner: ResumeOwner): { text: string; redactions: number } {
  const count = { n: 0 };
  const hit = (token: string) => () => {
    count.n++;
    return token;
  };
  let out = text.replace(/\r\n?/g, "\n");

  // Contact details anywhere.
  out = out
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, hit("[email]"))
    .replace(/(?:https?:\/\/|www\.)\S+/gi, hit("[link]"))
    .replace(
      /\b(?:[a-z]{2,3}\.)?(?:linkedin|github|gitlab|behance|dribbble|medium|twitter|instagram|facebook|leetcode|kaggle)\.com\S*/gi,
      hit("[link]")
    )
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => {
      if (m.replace(/\D/g, "").length < 10) return m; // date ranges like "2019 - 2023"
      count.n++;
      return "[phone]";
    });

  // The owner's own details, wherever they appear.
  const full = owner.name?.trim();
  if (full && full.length > 1) {
    out = out.replace(new RegExp(escapeRegExp(full).replace(/\s+/g, "\\s+"), "gi"), hit("[name]"));
    for (const part of full.split(/\s+/)) {
      // Case-sensitive so a first name like "Will" doesn't erase the word "will".
      if (part.length >= 3) out = out.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, "g"), hit("[name]"));
    }
  }
  // Personal sites named after the owner, e.g. "priya.dev" or "priyashah.io".
  for (const part of full ? full.split(/\s+/) : []) {
    if (part.length < 4) continue;
    out = out.replace(new RegExp(`\\b[\\w-]*${escapeRegExp(part)}[\\w-]*\\.[a-z]{2,}\\S*`, "gi"), hit("[link]"));
  }

  // Header-only heuristics: name line, "City, Country", street, postcode.
  const { header, rest } = splitHeader(out);
  const cleanHeader = stripHeaderPlaceholders(redactHeader(header, owner, count));
  out = cleanHeader + (cleanHeader && rest && !cleanHeader.endsWith("\n") ? "\n" : "") + rest;

  return { text: out, redactions: count.n };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Re-creates line breaks that PDF extraction threw away. */
function restoreLineBreaks(text: string): string {
  let out = text.replace(/[ \t]+/g, " ");

  const looksFlat = out.split("\n").filter((l) => l.trim()).length < 6;

  // Every bullet glyph starts a new line.
  out = out.replace(new RegExp(`\\s*([${BULLETS}])\\s*`, "g"), "\n$1 ");

  if (looksFlat) {
    // ALL-CAPS section headings sitting inside one long run of text.
    out = out.replace(new RegExp(`\\s+(${HEADING_ALT_UPPER})(?=\\s|:|$)`, "g"), "\n\n$1\n");
    // Title-case headings followed by a colon: "Skills: React, ..."
    out = out.replace(new RegExp(`\\s+(${HEADING_ALT})\\s*:`, "gi"), "\n\n$1\n");
  }
  return out;
}

function titleCase(heading: string): string {
  const cleaned = heading
    .replace(/[:\-–—|]+$/g, "")
    .replace(/^[#*\s]+/, "")
    .trim()
    .toLowerCase();
  return cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function formatResumeText(text: string): ResumeSection[] {
  const lines = restoreLineBreaks(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: ResumeSection[] = [];
  let current: ResumeSection = { heading: null, blocks: [] };

  const flush = () => {
    if (current.blocks.length > 0 || current.heading) sections.push(current);
  };

  const bulletRe = new RegExp(`^[${BULLETS}]\\s*|^[-*–]\\s+`);
  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      current = { heading: titleCase(line), blocks: [] };
      continue;
    }
    const bullet = bulletRe.exec(line);
    if (bullet) {
      const item = line.slice(bullet[0].length).trim();
      if (!item) continue;
      const last = current.blocks[current.blocks.length - 1];
      if (last && last.type === "ul") last.items.push(item);
      else current.blocks.push({ type: "ul", items: [item] });
    } else {
      current.blocks.push({ type: "p", text: line });
    }
  }
  flush();
  return sections;
}

/** Redact, then format. The one call the admin page makes. */
export function prepareResumeForAdmin(text: string, owner: ResumeOwner): FormattedResume {
  const redacted = redactResumeText(text, owner);
  return { sections: formatResumeText(redacted.text), redactions: redacted.redactions };
}
