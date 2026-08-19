import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { analysisResultSchema, type ResumeAnalysisDetail } from "@/features/resume-analyzer/lib/analysisSchema";

async function loadOwnedAnalysis(id: string, userId: string) {
  const analysis = await db.resumeAnalysis.findUnique({ where: { id } });
  if (!analysis || analysis.userId !== userId) return null;
  return analysis;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const analysis = await loadOwnedAnalysis(id, session.userId);
  if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

  let result;
  try {
    result = analysisResultSchema.parse(JSON.parse(analysis.resultJson));
  } catch {
    logger.error("resume-analyzer", "Stored result JSON failed to parse", { analysisId: id });
    return NextResponse.json({ error: "This analysis is corrupted" }, { status: 500 });
  }

  const detail: ResumeAnalysisDetail = {
    id: analysis.id,
    fileName: analysis.fileName,
    jobTitle: analysis.jobTitle,
    jobDescription: analysis.jobDescription,
    resumeText: analysis.resumeText,
    matchScore: analysis.matchScore,
    createdAt: analysis.createdAt.toISOString(),
    result,
  };

  return NextResponse.json({ analysis: detail });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedAnalysis(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

  await db.resumeAnalysis.delete({ where: { id } });
  logger.info("resume-analyzer", "Analysis deleted", { analysisId: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}
