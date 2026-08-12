import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { getResumeFormat } from "@/features/resume-builder/formats";

const createSchema = z.object({
  format: z.string().min(1),
  title: z.string().trim().min(1).max(150),
  answers: z.record(z.string(), z.unknown()),
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

    const format = getResumeFormat(parsed.data.format);
    if (!format) {
      return NextResponse.json({ error: "Unknown resume format" }, { status: 400 });
    }

    // answers is validated as a generic record above; the format's own
    // render() is what actually interprets its shape.
    const answers = parsed.data.answers as Parameters<typeof format.render>[0];
    const html = format.render(answers);

    const resume = await db.resume.create({
      data: {
        userId: session.userId,
        format: format.id,
        title: parsed.data.title,
        fieldsJson: JSON.stringify(answers),
        htmlContent: html,
      },
    });

    logger.info("resume-builder", "Resume created", { resumeId: resume.id, userId: session.userId });
    return NextResponse.json({ id: resume.id });
  } catch (error) {
    logger.error("resume-builder", "Create resume failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't build your resume. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const resumes = await db.resume.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, format: true, status: true, updatedAt: true },
  });
  return NextResponse.json({ resumes });
}
