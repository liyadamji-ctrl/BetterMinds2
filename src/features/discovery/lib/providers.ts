/**
 * External sites the Programs / Internships pages link out to. Every builder
 * returns a *search-results* URL — the site's list of matches — never a single
 * course or job. Pure functions, safe to import from client components.
 *
 * Search URL formats belong to the providers and can change; this file is the
 * only place to fix one.
 */

export type ProgramFilters = {
  /** "" | "beginner" | "intermediate" | "advanced" */
  level: string;
  freeOnly: boolean;
};

export type InternshipFilters = {
  location: string;
  remote: boolean;
  /** "internship" | "job" */
  jobType: string;
  /** The person's strongest skills, usually read from their resume. */
  skills?: string[];
  /** "" | "internship" | "entry" | "associate": how senior a role they can realistically fill. */
  experience?: string;
};

/** Words that mark a posting as too senior for someone early in their career. */
const SENIOR_TERMS = ["senior", "lead", "principal", "director", "manager", "staff", "head of"];
const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

export type ProviderLink = { id: string; name: string; url: string; note?: string };

const enc = encodeURIComponent;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildProgramLinks(keyword: string, filters: ProgramFilters): ProviderLink[] {
  const q = [filters.level, keyword].filter(Boolean).join(" ");
  return [
    { id: "coursera", name: "Coursera", url: `https://www.coursera.org/search?query=${enc(q)}${filters.freeOnly ? "&free=true" : ""}` },
    { id: "udemy", name: "Udemy", url: `https://www.udemy.com/courses/search/?q=${enc(q)}${filters.freeOnly ? "&price=price-free" : ""}` },
    { id: "edx", name: "edX", url: `https://www.edx.org/search?q=${enc(q)}` },
    { id: "linkedin-learning", name: "LinkedIn Learning", url: `https://www.linkedin.com/learning/search?keywords=${enc(q)}` },
    {
      id: "google-skillshop",
      name: "Google Skillshop",
      url: "https://skillshop.exceedlms.com/student/catalog",
      note: "Skillshop has no keyword search, so this opens its full catalog.",
    },
    { id: "freecodecamp", name: "freeCodeCamp", url: `https://www.freecodecamp.org/news/search/?query=${enc(keyword)}` },
    { id: "khan-academy", name: "Khan Academy", url: `https://www.khanacademy.org/search?page_search_query=${enc(keyword)}` },
  ];
}

export function buildInternshipLinks(keyword: string, filters: InternshipFilters): ProviderLink[] {
  const isInternship = filters.jobType !== "job";
  const q = isInternship ? `${keyword} internship` : keyword;
  const location = filters.remote ? "Remote" : filters.location.trim();
  const qWithLocation = [q, filters.remote ? "remote" : filters.location.trim()].filter(Boolean).join(" ");
  const internshalaKind = isInternship ? "internships" : "jobs";

  const skills = (filters.skills ?? []).filter(Boolean).slice(0, 4);
  const experience = filters.experience ?? "";
  // Boolean query: the title, at least one of the person's skills, and none of the senior-level words.
  const personalized = skills.length > 0 || experience !== "";
  const boolQuery = personalized
    ? [
        q,
        skills.length ? `(${skills.map(quote).join(" OR ")})` : "",
        experience !== "associate" ? `NOT (${SENIOR_TERMS.map(quote).join(" OR ")})` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : q;
  const plainSkills = skills.slice(0, 2).join(" ");
  const qWithSkills = [qWithLocation, plainSkills].filter(Boolean).join(" ");

  const linkedin = new URLSearchParams({ keywords: boolQuery });
  if (location) linkedin.set("location", location);
  if (isInternship) linkedin.set("f_JT", "I");
  if (filters.remote) linkedin.set("f_WT", "2");
  // LinkedIn experience level: 1 = Internship, 2 = Entry level, 3 = Associate.
  const linkedinLevel = { internship: "1", entry: "2", associate: "3" }[experience];
  if (linkedinLevel) linkedin.set("f_E", linkedinLevel);
  // Posted in the last month, so the openings are likely still open.
  if (personalized) linkedin.set("f_TPR", "r2592000");

  const indeed = new URLSearchParams({ q: boolQuery });
  if (location) indeed.set("l", location);
  if (experience === "entry" || experience === "internship") indeed.set("explvl", "entry_level");
  if (experience === "associate") indeed.set("explvl", "mid_level");
  if (personalized) indeed.set("fromage", "30");

  return [
    { id: "linkedin", name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?${linkedin}` },
    { id: "indeed", name: "Indeed", url: `https://www.indeed.com/jobs?${indeed}` },
    { id: "glassdoor", name: "Glassdoor", url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc(qWithSkills)}` },
    { id: "internshala", name: "Internshala", url: `https://internshala.com/${internshalaKind}/keywords-${slug(keyword)}/` },
    { id: "wellfound", name: "Wellfound", url: `https://wellfound.com/role/${slug(keyword)}` },
    { id: "google-jobs", name: "Google Jobs", url: `https://www.google.com/search?q=${enc(qWithSkills)}&ibp=htl;jobs` },
  ];
}
