import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { writeReport } from "@/features/interview/lib/ai";
import { overallScores } from "@/features/interview/lib/scoring";
import type { InterviewQuestion, InterviewReport } from "@/features/interview/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { id } = await params;
    const interview = await db.interviewSession.findUnique({ where: { id } });
    if (!interview || interview.userId !== session.userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (interview.status === "COMPLETED" && interview.reportJson) {
      return NextResponse.json({ report: JSON.parse(interview.reportJson) as InterviewReport });
    }

    const questions = JSON.parse(interview.questionsJson) as InterviewQuestion[];
    if (!questions.some((q) => q.analysis)) {
      return NextResponse.json({ error: "Answer at least one question first" }, { status: 400 });
    }

    const scores = overallScores(questions);
    const written = await writeReport({ jobTitle: interview.jobTitle, questions, overall: scores.overall });

    const report: InterviewReport = {
      overallScore: scores.overall,
      contentScore: scores.content,
      deliveryScore: scores.delivery,
      cameraScore: scores.camera,
      cameraUsed: scores.camera !== null,
      summary: written.summary,
      strengths: written.strengths,
      improvements: written.improvements,
      nextSteps: written.nextSteps,
    };

    await db.interviewSession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        reportJson: JSON.stringify(report),
        overallScore: report.overallScore,
      },
    });

    logger.info("interview", "Session finished", { sessionId: id, userId: session.userId });
    await trackEvent({
      userId: session.userId,
      feature: "interview-simulator",
      action: "session_finished",
      metadata: { overallScore: report.overallScore },
    });
    return NextResponse.json({ report });
  } catch (error) {
    logger.error("interview", "Finish session failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't build your report right now. Please try again." }, { status: 500 });
  }
}
