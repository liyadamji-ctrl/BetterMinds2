import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { groqChat } from "@/lib/groq";
import {
  analyzeRequestSchema,
  analysisResultSchema,
  type ResumeAnalysisSummary,
} from "@/features/resume-analyzer/lib/analysisSchema";

// Keeps the prompt (and Groq's bill/latency) bounded even though we store
// the full validated text in the database.
const PROMPT_RESUME_CHARS = 15000;
const PROMPT_JOB_DESCRIPTION_CHARS = 8000;

const SYSTEM_PROMPT = `You are an expert technical recruiter and resume reviewer. You compare a candidate's resume against a specific job (title, and optionally a description) and produce a structured, honest assessment.

Respond with ONLY a single JSON object, no prose before or after it, matching exactly this shape:
{
  "matchScore": <integer 0-100, how well the resume matches the job>,
  "summary": "<2-4 sentence overview of the fit>",
  "strengths": ["<specific strength relevant to this job>", ...],
  "gaps": ["<specific gap or missing requirement>", ...],
  "suggestions": ["<concrete, actionable suggestion to improve the resume for this job>", ...],
  "missingKeywords": ["<important keyword/skill from the job that's missing or weak in the resume>", ...]
}

Keep each array to at most 6 items. Be specific and reference details from the resume and job, not generic advice.`;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let parsed;
  try {
    const body = await request.json();
    parsed = analyzeRequestSchema.safeParse(body);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { fileName, jobTitle, jobDescription, resumeText } = parsed.data;

  const userPrompt = [
    `JOB TITLE: ${jobTitle}`,
    jobDescription
      ? `JOB DESCRIPTION:\n${jobDescription.slice(0, PROMPT_JOB_DESCRIPTION_CHARS)}`
      : "JOB DESCRIPTION: (not provided — evaluate against the title alone)",
    `RESUME:\n${resumeText.slice(0, PROMPT_RESUME_CHARS)}`,
  ].join("\n\n");

  try {
    const raw = await groqChat({ system: SYSTEM_PROMPT, user: userPrompt });

    let resultJson: unknown;
    try {
      resultJson = JSON.parse(raw);
    } catch {
      throw new Error("Groq returned non-JSON output");
    }

    const result = analysisResultSchema.parse(resultJson);

    const analysis = await db.resumeAnalysis.create({
      data: {
        userId: session.userId,
        fileName: fileName ?? null,
        jobTitle,
        jobDescription: jobDescription ?? null,
        resumeText,
        matchScore: result.matchScore,
        resultJson: JSON.stringify(result),
      },
    });

    logger.info("resume-analyzer", "Analysis created", {
      analysisId: analysis.id,
      userId: session.userId,
      matchScore: result.matchScore,
    });

    return NextResponse.json({
      id: analysis.id,
      result,
    });
  } catch (error) {
    logger.error("resume-analyzer", "Analysis failed", { error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't analyze that resume right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const rows = await db.resumeAnalysis.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, jobTitle: true, matchScore: true, createdAt: true },
  });

  const analyses: ResumeAnalysisSummary[] = rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    jobTitle: row.jobTitle,
    matchScore: row.matchScore,
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({ analyses });
}
