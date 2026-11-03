import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { id } = await params;
    // Scoped by userId: a no-op, not an error, for someone else's session.
    await db.interviewSession.deleteMany({ where: { id, userId: session.userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("interview", "Delete session failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't delete that session." }, { status: 500 });
  }
}
