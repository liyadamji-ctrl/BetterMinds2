import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { screenApplication } from "@/features/screening/lib/screenApplication";
import { anonymizeResumeText, htmlToText } from "@/features/screening/lib/resumeText";
import {
  screenJobRequestSchema,
  type ScreeningResult,
} from "@/features/screening/lib/screeningSchema";

// A few Groq calls at a time: fast enough for a typical applicant list
// without tripping rate limits.
const CONCURRENCY = 3;
// Screening many applicants takes a while; let the function run long enough.
export const maxDuration = 300;

export type ScreenedApplication = {
  id: string;
  matchScore: number;
  screening: ScreeningResult;
  screenedAt: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.role !== "COMPANY") {
    return NextResponse.json({ error: "Only company accounts can screen applicants" }, { status: 403 });
  }

  const { id } = await params;
  const job = await db.job.findUnique({ where: { id } });
  if (!job || job.companyId !== session.userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "AI screening isn't configured. GROQ_API_KEY is not set." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = screenJobRequestSchema.safeParse(body);
  const force = parsed.success && parsed.data.force === true;

  const applications = await db.application.findMany({
    where: { jobId: id, ...(force ? {} : { screenedAt: null }) },
    include: { user: true, resume: true },
    orderBy: { createdAt: "asc" },
  });

  const screened: ScreenedApplication[] = [];
  let failed = 0;

  async function screenOne(app: (typeof applications)[number]) {
    try {
      const text = anonymizeResumeText(htmlToText(app.resume.htmlContent), {
        name: app.user.name,
        email: app.user.email,
      });
      if (text.length < 30) throw new Error("Resume has too little text to screen");

      const screening = await screenApplication(job!, text);
      const updated = await db.application.update({
        where: { id: app.id },
        data: {
          matchScore: screening.matchScore,
          screeningJson: JSON.stringify(screening),
          screenedAt: new Date(),
        },
      });
      await trackEvent({
        userId: session!.userId,
        feature: "ai-screening",
        action: "application_screened",
        metadata: { jobId: id, matchScore: screening.matchScore },
      });
      screened.push({
        id: app.id,
        matchScore: screening.matchScore,
        screening,
        screenedAt: updated.screenedAt!.toISOString(),
      });
    } catch (error) {
      failed += 1;
      logger.error("screening", "Screening failed", { applicationId: app.id, error: String(error) });
    }
  }

  // Simple worker pool over a shared queue.
  const queue = [...applications];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let app = queue.shift(); app; app = queue.shift()) await screenOne(app);
    })
  );

  logger.info("screening", "Job screened", {
    jobId: id,
    companyId: session.userId,
    screened: screened.length,
    failed,
  });

  return NextResponse.json({ screened, failed });
}
