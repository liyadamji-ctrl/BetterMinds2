import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { updateJobSchema } from "@/features/jobs/lib/types";

async function loadOwnedJob(id: string, companyId: string) {
  const job = await db.job.findUnique({ where: { id } });
  if (!job || job.companyId !== companyId) return null;
  return job;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role !== "COMPANY") {
    return NextResponse.json({ error: "Only company accounts can manage jobs" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadOwnedJob(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const job = await db.job.update({ where: { id }, data: parsed.data });
    logger.info("jobs", "Job updated", { jobId: id, companyId: session.userId });
    return NextResponse.json({ job });
  } catch (error) {
    logger.error("jobs", "Update job failed", { jobId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role !== "COMPANY") {
    return NextResponse.json({ error: "Only company accounts can manage jobs" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadOwnedJob(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  await db.job.delete({ where: { id } });
  logger.info("jobs", "Job deleted", { jobId: id, companyId: session.userId });
  return NextResponse.json({ ok: true });
}
