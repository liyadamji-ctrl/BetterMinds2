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
};

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

  const linkedin = new URLSearchParams({ keywords: q });
  if (location) linkedin.set("location", location);
  if (isInternship) linkedin.set("f_JT", "I");
  if (filters.remote) linkedin.set("f_WT", "2");

  const indeed = new URLSearchParams({ q });
  if (location) indeed.set("l", location);

  return [
    { id: "linkedin", name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?${linkedin}` },
    { id: "indeed", name: "Indeed", url: `https://www.indeed.com/jobs?${indeed}` },
    { id: "glassdoor", name: "Glassdoor", url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc(qWithLocation)}` },
    { id: "internshala", name: "Internshala", url: `https://internshala.com/${internshalaKind}/keywords-${slug(keyword)}/` },
    { id: "wellfound", name: "Wellfound", url: `https://wellfound.com/role/${slug(keyword)}` },
    { id: "google-jobs", name: "Google Jobs", url: `https://www.google.com/search?q=${enc(qWithLocation)}&ibp=htl;jobs` },
  ];
}
