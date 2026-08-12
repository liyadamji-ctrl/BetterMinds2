import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const recording = await db.sessionRecording.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    recording: { ...recording, events: JSON.parse(recording.events) },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  await db.sessionRecording.delete({ where: { id } }).catch(() => null);
  logger.info("admin:sessions", "Recording deleted", { recordingId: id, byAdmin: session.userId });
  return NextResponse.json({ ok: true });
}
