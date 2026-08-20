import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { createJobSchema } from "@/features/jobs/lib/types";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role !== "COMPANY") {
    return NextResponse.json({ error: "Only company accounts can post jobs" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const job = await db.job.create({
      data: {
        companyId: session.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        requirements: parsed.data.requirements,
        employmentType: parsed.data.employmentType,
        hoursPerWeek: parsed.data.hoursPerWeek,
        weeksPerYear: parsed.data.weeksPerYear,
        pay: parsed.data.pay,
        location: parsed.data.location,
        locationType: parsed.data.locationType,
      },
    });

    logger.info("jobs", "Job posted", { jobId: job.id, companyId: session.userId });
    return NextResponse.json({ id: job.id });
  } catch (error) {
    logger.error("jobs", "Create job failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't create that posting. Please try again." }, { status: 500 });
  }
}
