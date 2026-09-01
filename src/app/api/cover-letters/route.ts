import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { generateCoverLetterHtml } from "@/features/cover-letters/lib/generate";
import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

const createSchema = z.object({
  resumeId: z.string().min(1),
  jobId: z.string().optional(),
  companyName: z.string().trim().min(1).max(150).optional(),
  jobTitle: z.string().trim().min(1).max(150).optional(),
  jobDescription: z.string().trim().max(10000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const resume = await db.resume.findUnique({ where: { id: parsed.data.resumeId } });
    if (!resume || resume.userId !== session.userId) {
      return NextResponse.json({ error: "Choose one of your own resumes" }, { status: 400 });
    }

    let companyName: string;
    let jobTitle: string;
    let jobDescription: string | null;
    let jobId: string | null = null;

    if (parsed.data.jobId) {
      const job = await db.job.findUnique({
        where: { id: parsed.data.jobId },
        include: { company: { select: { name: true, profileJson: true } } },
      });
      if (!job) {
        return NextResponse.json({ error: "That job posting couldn't be found" }, { status: 400 });
      }
      const companyData = job.company.profileJson
        ? (JSON.parse(job.company.profileJson) as Record<string, string>)
        : null;
      companyName = companyData?.companyName ?? job.company.name ?? "the company";
      jobTitle = job.title;
      jobDescription = job.description;
      jobId = job.id;
    } else {
      if (!parsed.data.companyName || !parsed.data.jobTitle) {
        return NextResponse.json(
          { error: "Enter a company name and job title" },
          { status: 400 }
        );
      }
      companyName = parsed.data.companyName;
      jobTitle = parsed.data.jobTitle;
      jobDescription = parsed.data.jobDescription ?? null;
    }

    const answers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
    const html = await generateCoverLetterHtml(answers, {
      companyName,
      jobTitle,
      jobDescription,
      notes: parsed.data.notes ?? null,
    });

    const coverLetter = await db.coverLetter.create({
      data: {
        userId: session.userId,
        resumeId: resume.id,
        jobId,
        companyName,
        jobTitle,
        jobDescription,
        htmlContent: html,
      },
    });

    logger.info("cover-letters", "Cover letter generated", {
      coverLetterId: coverLetter.id,
      userId: session.userId,
    });
    return NextResponse.json({ id: coverLetter.id });
  } catch (error) {
    logger.error("cover-letters", "Cover letter generation failed", { error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't generate that cover letter right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
