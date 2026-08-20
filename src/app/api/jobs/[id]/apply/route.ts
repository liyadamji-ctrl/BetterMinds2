import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { applySchema } from "@/features/jobs/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id: jobId } = await params;
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "OPEN") {
    return NextResponse.json({ error: "This job posting isn't open for applications" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);
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

    const existing = await db.application.findUnique({
      where: { jobId_userId: { jobId, userId: session.userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "You've already applied to this job" }, { status: 409 });
    }

    const application = await db.application.create({
      data: {
        jobId,
        userId: session.userId,
        resumeId: parsed.data.resumeId,
        note: parsed.data.note,
      },
    });

    logger.info("jobs", "Application submitted", {
      applicationId: application.id,
      jobId,
      userId: session.userId,
    });
    return NextResponse.json({ id: application.id, status: application.status });
  } catch (error) {
    logger.error("jobs", "Apply failed", { jobId, error: String(error) });
    return NextResponse.json({ error: "Couldn't submit your application. Please try again." }, { status: 500 });
  }
}
