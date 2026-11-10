import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { profileFromResume } from "@/features/discovery/lib/fromResume";

const schema = z.object({ resumeId: z.string().min(1) });

/** Reads one of the signed-in user's resumes and suggests an internship search for it. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a resume" }, { status: 400 });

    const resume = await db.resume.findUnique({ where: { id: parsed.data.resumeId } });
    if (!resume || resume.userId !== session.userId) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const profile = await profileFromResume(resume.fieldsJson);
    return NextResponse.json(profile);
  } catch (error) {
    logger.error("discovery", "Reading resume for search failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't read that resume right now. Please try again." }, { status: 500 });
  }
}
