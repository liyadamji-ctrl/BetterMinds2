import { z } from "zod";

/**
 * Shared between the client (form submission + rendering results) and the
 * API route (request validation + parsing Groq's response). No `server-only`
 * here on purpose — zod runs fine in the browser too.
 */

export const analyzeRequestSchema = z.object({
  fileName: z.string().max(255).optional(),
  jobTitle: z.string().trim().min(1, "Job title is required").max(200),
  jobDescription: z.string().trim().max(20000).optional(),
  resumeText: z
    .string()
    .trim()
    .min(30, "That doesn't look like enough resume text to analyze.")
    .max(50000, "Resume text is too long — try a shorter file."),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/**
 * The shape we ask Groq for. Every field is defensively `.catch()`-ed with a
 * safe fallback — LLM output is never 100% guaranteed to match, and one
 * malformed field shouldn't blow up an otherwise-useful analysis.
 */
export const analysisResultSchema = z.object({
  matchScore: z.coerce.number().min(0).max(100).catch(0),
  summary: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  gaps: z.array(z.string()).catch([]),
  suggestions: z.array(z.string()).catch([]),
  missingKeywords: z.array(z.string()).catch([]),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export type ResumeAnalysisSummary = {
  id: string;
  fileName: string | null;
  jobTitle: string;
  matchScore: number | null;
  createdAt: string;
};

export type ResumeAnalysisDetail = ResumeAnalysisSummary & {
  jobDescription: string | null;
  resumeText: string;
  result: AnalysisResult;
};
