import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { updateApplicationStatusSchema } from "@/features/jobs/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role !== "COMPANY") {
    return NextResponse.json({ error: "Only company accounts can manage applications" }, { status: 403 });
  }

  const { id } = await params;
  const application = await db.application.findUnique({ where: { id }, include: { job: true } });
  if (!application || application.job.companyId !== session.userId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateApplicationStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await db.application.update({ where: { id }, data: { status: parsed.data.status } });
    logger.info("jobs", "Application status updated", { applicationId: id, status: parsed.data.status });
    return NextResponse.json({ application: updated });
  } catch (error) {
    logger.error("jobs", "Update application failed", { applicationId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't save that change. Please try again." }, { status: 500 });
  }
}
