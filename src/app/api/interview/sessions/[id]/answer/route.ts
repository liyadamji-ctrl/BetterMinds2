import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { analyzeAnswer } from "@/features/interview/lib/ai";
import { cameraScore, countFillers, deliveryScore, wordsPerMinute } from "@/features/interview/lib/scoring";
import type { InterviewQuestion } from "@/features/interview/types";

const pct = z.number().min(0).max(100).transform(Math.round);

const schema = z.object({
  questionId: z.string().min(1),
  transcript: z.string().trim().max(8000),
  durationSec: z.number().min(0).max(1800),
  selfConfidence: z.number().int().min(1).max(5).nullable().optional(),
  camera: z
    .object({
      facePresentPct: pct,
      eyeContactPct: pct,
      headSteadyPct: pct,
      samples: z.number().int().min(0).max(100000),
    })
    .nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const interview = await db.interviewSession.findUnique({ where: { id } });
    if (!interview || interview.userId !== session.userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (interview.status === "COMPLETED") {
      return NextResponse.json({ error: "This interview is already finished" }, { status: 400 });
    }

    const questions = JSON.parse(interview.questionsJson) as InterviewQuestion[];
    const index = questions.findIndex((q) => q.id === input.questionId);
    if (index === -1) return NextResponse.json({ error: "Question not found" }, { status: 400 });
    const question = questions[index];

    const transcript = input.transcript;
    const ai =
      transcript.length > 0
        ? await analyzeAnswer({
            jobTitle: interview.jobTitle,
            question: question.question,
            lookFor: question.lookFor,
            transcript,
          })
        : { contentScore: 0, strengths: [], improvements: ["No answer was recorded for this question."], betterAnswerTip: "" };

    question.transcript = transcript;
    question.durationSec = Math.round(input.durationSec);
    question.wordsPerMinute = wordsPerMinute(transcript, input.durationSec);
    question.fillerCount = countFillers(transcript);
    question.camera = input.camera;
    question.selfConfidence = input.selfConfidence ?? null;
    question.analysis = {
      contentScore: ai.contentScore,
      deliveryScore: deliveryScore(transcript, input.durationSec),
      cameraScore: cameraScore(input.camera),
      strengths: ai.strengths,
      improvements: ai.improvements,
      betterAnswerTip: ai.betterAnswerTip,
    };

    await db.interviewSession.update({ where: { id }, data: { questionsJson: JSON.stringify(questions) } });
    return NextResponse.json({ question });
  } catch (error) {
    logger.error("interview", "Answer analysis failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't analyze that answer right now. Please try again." }, { status: 500 });
  }
}
