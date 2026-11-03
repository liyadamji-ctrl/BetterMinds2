import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { generateQuestions } from "@/features/interview/lib/ai";
import type { InterviewQuestion } from "@/features/interview/types";
import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

const createSchema = z.object({
  resumeId: z.string().min(1).optional(),
  jobId: z.string().optional(),
  jobTitle: z.string().trim().min(2).max(150).optional(),
  companyName: z.string().trim().max(150).optional(),
  jobDescription: z.string().trim().max(10000).optional(),
  interviewType: z.enum(["BEHAVIORAL", "TECHNICAL", "MIXED"]),
  count: z.number().int().min(3).max(10),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    let resumeAnswers: ResumeAnswers | null = null;
    if (input.resumeId) {
      const resume = await db.resume.findUnique({ where: { id: input.resumeId } });
      if (!resume || resume.userId !== session.userId) {
        return NextResponse.json({ error: "Choose one of your own resumes" }, { status: 400 });
      }
      resumeAnswers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
    }

    let jobTitle: string;
    let companyName: string | null = null;
    let jobDescription: string | null = null;
    let jobId: string | null = null;

    if (input.jobId) {
      const job = await db.job.findUnique({
        where: { id: input.jobId },
        include: { company: { select: { name: true, profileJson: true } } },
      });
      if (!job) {
        return NextResponse.json({ error: "That job posting couldn't be found" }, { status: 400 });
      }
      const companyData = job.company.profileJson
        ? (JSON.parse(job.company.profileJson) as Record<string, string>)
        : null;
      jobTitle = job.title;
      companyName = companyData?.companyName ?? job.company.name ?? null;
      jobDescription = job.description;
      jobId = job.id;
    } else {
      if (!input.jobTitle) {
        return NextResponse.json({ error: "Enter the role you're interviewing for" }, { status: 400 });
      }
      jobTitle = input.jobTitle;
      companyName = input.companyName || null;
      jobDescription = input.jobDescription || null;
    }

    const generated = await generateQuestions({
      jobTitle,
      companyName,
      jobDescription,
      interviewType: input.interviewType,
      count: input.count,
      resume: resumeAnswers,
    });

    const questions: InterviewQuestion[] = generated.map((q) => ({
      ...q,
      transcript: null,
      durationSec: null,
      wordsPerMinute: null,
      fillerCount: null,
      camera: null,
      analysis: null,
    }));

    const created = await db.interviewSession.create({
      data: {
        userId: session.userId,
        resumeId: input.resumeId ?? null,
        jobId,
        jobTitle,
        companyName,
        jobDescription,
        interviewType: input.interviewType,
        questionsJson: JSON.stringify(questions),
      },
    });

    logger.info("interview", "Session created", { sessionId: created.id, userId: session.userId });
    await trackEvent({
      userId: session.userId,
      feature: "interview-simulator",
      action: "session_started",
      metadata: { interviewType: input.interviewType },
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    logger.error("interview", "Create session failed", { error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't set up that interview right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
