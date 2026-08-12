import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

const schema = z.object({ allowed: z.boolean() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await db.consent.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, sessionRecordingAllowed: parsed.data.allowed },
    update: { sessionRecordingAllowed: parsed.data.allowed, respondedAt: new Date() },
  });

  logger.info("session-recording", "Consent recorded", {
    userId: session.userId,
    allowed: parsed.data.allowed,
  });
  return NextResponse.json({ ok: true });
}
