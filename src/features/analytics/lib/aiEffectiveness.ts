import { recommendationFromScore, type Recommendation } from "@/features/screening/lib/screeningSchema";

/**
 * Pure functions (no DB) that turn a company's applications into "is the AI
 * screening working for them?" numbers. There is no ground truth for whether
 * a candidate is truly good, so the signal is what recruiters do next: if
 * they shortlist the people the AI liked and reject the ones it didn't, the
 * AI is matching their judgement.
 */

export type ScreeningInput = {
  /** SUBMITTED | REVIEWED | SHORTLISTED | REJECTED */
  status: string;
  matchScore: number | null;
  /** Null when the application has not been screened. */
  recommendation: Recommendation | null;
};

export type Verdict = "WORKING_WELL" | "MIXED" | "NOT_WORKING" | "NOT_ENOUGH_DATA" | "NOT_USED";

export const VERDICT_LABELS: Record<Verdict, string> = {
  WORKING_WELL: "Working well",
  MIXED: "Mixed results",
  NOT_WORKING: "Not working",
  NOT_ENOUGH_DATA: "Not enough data",
  NOT_USED: "Not used yet",
};

/** Decisions needed before an agreement rate is trusted. */
export const MIN_DECISIONS = 5;
export const WORKING_WELL_AT = 70;
export const MIXED_AT = 50;

export type ScreeningSummary = {
  applicants: number;
  screened: number;
  /** Share of applicants that have been screened, 0-100. */
  adoptionRate: number | null;
  avgScore: number | null;
  strong: number;
  possible: number;
  weak: number;
  shortlisted: number;
  rejected: number;
  /** Screened applicants the recruiter has shortlisted or rejected. */
  decided: number;
  /** Decisions that matched the AI's recommendation. */
  agreed: number;
  /** 0-100, null until there is at least one decision. */
  agreementRate: number | null;
  /** AI said Strong match but the recruiter rejected. */
  strongRejected: number;
  /** AI said Weak match but the recruiter shortlisted. */
  weakShortlisted: number;
  verdict: Verdict;
};

export function summarizeScreening(apps: ScreeningInput[]): ScreeningSummary {
  let screened = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let strong = 0;
  let possible = 0;
  let weak = 0;
  let shortlisted = 0;
  let rejected = 0;
  let decided = 0;
  let agreed = 0;
  let strongRejected = 0;
  let weakShortlisted = 0;

  for (const app of apps) {
    if (app.status === "SHORTLISTED") shortlisted++;
    if (app.status === "REJECTED") rejected++;

    const rec = app.recommendation;
    if (!rec) continue;
    screened++;
    if (app.matchScore !== null) {
      scoreSum += app.matchScore;
      scoreCount++;
    }
    if (rec === "STRONG_MATCH") strong++;
    else if (rec === "POSSIBLE") possible++;
    else weak++;

    const isShortlist = app.status === "SHORTLISTED";
    const isReject = app.status === "REJECTED";
    if (!isShortlist && !isReject) continue;
    decided++;
    const aiLiked = rec !== "WEAK";
    if ((aiLiked && isShortlist) || (!aiLiked && isReject)) agreed++;
    if (rec === "STRONG_MATCH" && isReject) strongRejected++;
    if (rec === "WEAK" && isShortlist) weakShortlisted++;
  }

  const agreementRate = decided > 0 ? Math.round((agreed / decided) * 100) : null;

  let verdict: Verdict;
  if (screened === 0) verdict = "NOT_USED";
  else if (decided < MIN_DECISIONS || agreementRate === null) verdict = "NOT_ENOUGH_DATA";
  else if (agreementRate >= WORKING_WELL_AT) verdict = "WORKING_WELL";
  else if (agreementRate >= MIXED_AT) verdict = "MIXED";
  else verdict = "NOT_WORKING";

  return {
    applicants: apps.length,
    screened,
    adoptionRate: apps.length > 0 ? Math.round((screened / apps.length) * 100) : null,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    strong,
    possible,
    weak,
    shortlisted,
    rejected,
    decided,
    agreed,
    agreementRate,
    strongRejected,
    weakShortlisted,
    verdict,
  };
}

/**
 * Reads the recommendation out of a stored screening_json. Falls back to the
 * score bands if the JSON is unreadable but a score exists, so one bad row
 * doesn't drop an application out of the stats.
 */
export function readRecommendation(screeningJson: string | null, matchScore: number | null): Recommendation | null {
  if (screeningJson) {
    try {
      const parsed = JSON.parse(screeningJson) as { recommendation?: string; matchScore?: number };
      if (parsed.recommendation === "STRONG_MATCH" || parsed.recommendation === "POSSIBLE" || parsed.recommendation === "WEAK") {
        return parsed.recommendation;
      }
      const score = matchScore ?? parsed.matchScore;
      if (typeof score === "number") return recommendationFromScore(score);
    } catch {
      // fall through
    }
  }
  return matchScore !== null ? recommendationFromScore(matchScore) : null;
}
