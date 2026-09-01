import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { generateCoverLetterHtml } from "@/features/cover-letters/lib/generate";
import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const coverLetter = await db.coverLetter.findUnique({ where: { id } });
  if (!coverLetter || coverLetter.userId !== session.userId) {
    return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
  }

  try {
    const resume = await db.resume.findUnique({ where: { id: coverLetter.resumeId } });
    if (!resume) {
      return NextResponse.json(
        { error: "The resume this letter was based on no longer exists" },
        { status: 400 }
      );
    }

    const answers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
    const html = await generateCoverLetterHtml(answers, {
      companyName: coverLetter.companyName,
      jobTitle: coverLetter.jobTitle,
      jobDescription: coverLetter.jobDescription,
      notes: null,
    });

    const updated = await db.coverLetter.update({ where: { id }, data: { htmlContent: html } });
    logger.info("cover-letters", "Cover letter regenerated", { coverLetterId: id, userId: session.userId });
    return NextResponse.json({ coverLetter: updated });
  } catch (error) {
    logger.error("cover-letters", "Cover letter regeneration failed", { coverLetterId: id, error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't regenerate that cover letter right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
