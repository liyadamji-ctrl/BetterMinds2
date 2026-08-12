import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/features/auth/lib/guard";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const recordings = await db.sessionRecording.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      durationMs: true,
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ recordings });
}
