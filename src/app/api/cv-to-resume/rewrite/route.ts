import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { rewriteResumeText } from "@/features/cv-to-resume/lib/ai";

const schema = z.object({
  text: z.string().trim().min(1, "Select some text to edit first").max(3000),
  instruction: z.string().trim().min(3, "Tell the AI what to change").max(300),
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
    const text = await rewriteResumeText(parsed.data.text, parsed.data.instruction);
    await trackEvent({ userId: session.userId, feature: "cv-to-resume", action: "ai_rewrite" });
    return NextResponse.json({ text });
  } catch (error) {
    logger.error("cv-to-resume", "AI rewrite failed", { error: String(error) });
    const message =
      error instanceof Error && error.message.startsWith("GROQ_API_KEY")
        ? error.message
        : "Couldn't rewrite that right now. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
