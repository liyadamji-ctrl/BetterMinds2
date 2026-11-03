import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { analyzeCv } from "@/features/cv-to-resume/lib/ai";

const schema = z.object({
  cvText: z.string().trim().min(100, "That CV looks too short to work with").max(60000),
  targetRole: z.string().trim().max(150).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const analysis = await analyzeCv(parsed.data.cvText, parsed.data.targetRole ?? null);
    logger.info("cv-to-resume", "CV analyzed", { userId: session.userId });
    await trackEvent({ userId: session.userId, feature: "cv-to-resume", action: "cv_analyzed" });
    return NextResponse.json(analysis);
  } catch (error) {
    logger.error("cv-to-resume", "CV analysis failed", { error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't analyze that CV right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
