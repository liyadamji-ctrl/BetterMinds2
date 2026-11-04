import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { z } from "zod";
import { MAX_REVISION_FEEDBACK_CHARS, reviseCoverLetterHtml } from "@/features/cover-letters/lib/generate";
import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

const bodySchema = z.object({
  feedback: z.string().trim().min(1, "Tell us what you'd like to change").max(MAX_REVISION_FEEDBACK_CHARS),
  /** The letter as currently shown in the editor, including unsaved manual edits. */
  currentHtml: z.string().max(60000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Tell us what you'd like to change" },
      { status: 400 }
    );
  }

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
    const html = await reviseCoverLetterHtml(
      answers,
      {
        companyName: coverLetter.companyName,
        jobTitle: coverLetter.jobTitle,
        jobDescription: coverLetter.jobDescription,
        notes: null,
      },
      parsed.data.currentHtml?.trim() ? parsed.data.currentHtml : coverLetter.htmlContent,
      parsed.data.feedback
    );

    const updated = await db.coverLetter.update({ where: { id }, data: { htmlContent: html } });
    logger.info("cover-letters", "Cover letter regenerated", { coverLetterId: id, userId: session.userId });
    await trackEvent({ userId: session.userId, feature: "cover-letters", action: "cover_letter_regenerated" });
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
