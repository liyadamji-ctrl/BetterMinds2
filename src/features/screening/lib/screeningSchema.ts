import { z } from "zod";

/**
 * Shared between the API route (parsing Groq's response) and the client
 * (rendering results). No `server-only` here on purpose — zod runs fine in
 * the browser too.
 */

export const RECOMMENDATIONS = ["STRONG_MATCH", "POSSIBLE", "WEAK"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  STRONG_MATCH: "Strong match",
  POSSIBLE: "Possible",
  WEAK: "Weak match",
};

/** Score bands used to derive a recommendation when the model's own is unusable. */
export function recommendationFromScore(score: number): Recommendation {
  if (score >= 75) return "STRONG_MATCH";
  if (score >= 50) return "POSSIBLE";
  return "WEAK";
}

/**
 * The shape we ask Groq for. Every field is defensively `.catch()`-ed with a
 * safe fallback — LLM output is never 100% guaranteed to match, and one
 * malformed field shouldn't blow up an otherwise-useful screening.
 */
export const screeningResultSchema = z.object({
  matchScore: z.coerce.number().min(0).max(100).catch(0),
  recommendation: z.enum(RECOMMENDATIONS).optional().catch(undefined),
  summary: z.string().catch(""),
  matchedSkills: z.array(z.string()).catch([]),
  missingRequirements: z.array(z.string()).catch([]),
  experienceFit: z.string().catch(""),
  redFlags: z.array(z.string()).catch([]),
});

export type ScreeningResult = Omit<z.infer<typeof screeningResultSchema>, "recommendation"> & {
  recommendation: Recommendation;
};

/** Parses Groq's JSON and guarantees a recommendation is always present. */
export function parseScreeningResult(raw: unknown): ScreeningResult {
  const parsed = screeningResultSchema.parse(raw);
  const matchScore = Math.round(parsed.matchScore);
  return {
    ...parsed,
    matchScore,
    recommendation: parsed.recommendation ?? recommendationFromScore(matchScore),
  };
}

export const screenJobRequestSchema = z.object({
  /** Re-screen applicants that already have a score. */
  force: z.boolean().optional(),
});
