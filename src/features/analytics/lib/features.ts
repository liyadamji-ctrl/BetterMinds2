/**
 * The single list of product features the admin "Feature usage" page reports
 * on. No `server-only`: the id type is shared by the tracker, the API and the
 * admin UI.
 *
 * `useActions` are the event actions that count as "someone actually used
 * this" (as opposed to merely opening the page). For features that are just a
 * page to read, "view" is the use.
 *
 * When you add a feature: add it here, call trackEvent() from its server
 * route, and add its page path to PATH_RULES so opening it is counted too.
 */

export type FeatureId =
  | "resume-builder"
  | "cv-to-resume"
  | "resume-analyzer"
  | "cover-letters"
  | "email-templates"
  | "job-board"
  | "my-applications"
  | "interview-simulator"
  | "programs"
  | "internships"
  | "job-postings"
  | "ai-screening";

export type FeatureDef = {
  id: FeatureId;
  label: string;
  audience: "Customer" | "Company";
  description: string;
  useActions: string[];
  /** True when the feature calls Groq — lets the admin see AI-powered usage. */
  usesAi: boolean;
};

export const FEATURES: FeatureDef[] = [
  { id: "resume-builder", label: "Resume builder", audience: "Customer", description: "Build a resume from a template", useActions: ["resume_created"], usesAi: false },
  { id: "cv-to-resume", label: "CV to resume (AI)", audience: "Customer", description: "Upload a CV and get an improved resume", useActions: ["cv_analyzed"], usesAi: true },
  { id: "resume-analyzer", label: "Resume analyzer", audience: "Customer", description: "Score a resume against a job", useActions: ["analysis_created"], usesAi: true },
  { id: "cover-letters", label: "Cover letters", audience: "Customer", description: "Generate a cover letter for a job", useActions: ["cover_letter_created"], usesAi: true },
  { id: "email-templates", label: "Email templates", audience: "Customer", description: "Copy-ready application emails", useActions: ["view"], usesAi: false },
  { id: "job-board", label: "Job board & applying", audience: "Customer", description: "Browse jobs and apply", useActions: ["applied"], usesAi: false },
  { id: "my-applications", label: "My applications", audience: "Customer", description: "Track submitted applications", useActions: ["view"], usesAi: false },
  { id: "interview-simulator", label: "Interview simulator", audience: "Customer", description: "Practice interviews with AI feedback", useActions: ["session_started"], usesAi: true },
  { id: "programs", label: "Programs search", audience: "Customer", description: "Find programs and courses", useActions: ["search_saved"], usesAi: true },
  { id: "internships", label: "Internships search", audience: "Customer", description: "Find internships", useActions: ["search_saved"], usesAi: true },
  { id: "job-postings", label: "Job postings", audience: "Company", description: "Companies post jobs and internships", useActions: ["job_posted"], usesAi: false },
  { id: "ai-screening", label: "AI applicant screening", audience: "Company", description: "AI scores and ranks applicants", useActions: ["application_screened"], usesAi: true },
];

export const FEATURES_BY_ID: Record<FeatureId, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f])
) as Record<FeatureId, FeatureDef>;

/** Page path -> feature, first match wins (most specific rules first). */
const PATH_RULES: Array<{ test: RegExp; feature: FeatureId }> = [
  { test: /^\/resume-builder\/from-cv(\/|$)/, feature: "cv-to-resume" },
  { test: /^\/resume-builder(\/|$)/, feature: "resume-builder" },
  { test: /^\/resume-analyzer(\/|$)/, feature: "resume-analyzer" },
  { test: /^\/cover-letters(\/|$)/, feature: "cover-letters" },
  { test: /^\/email-templates(\/|$)/, feature: "email-templates" },
  { test: /^\/jobs\/applications(\/|$)/, feature: "my-applications" },
  { test: /^\/jobs(\/|$)/, feature: "job-board" },
  { test: /^\/interview(\/|$)/, feature: "interview-simulator" },
  { test: /^\/programs(\/|$)/, feature: "programs" },
  { test: /^\/internships(\/|$)/, feature: "internships" },
  { test: /^\/company\/jobs\/[^/]+\/applicants(\/|$)/, feature: "ai-screening" },
  { test: /^\/company\/jobs(\/|$)/, feature: "job-postings" },
];

export function featureForPath(path: string): FeatureId | null {
  for (const rule of PATH_RULES) if (rule.test.test(path)) return rule.feature;
  return null;
}
