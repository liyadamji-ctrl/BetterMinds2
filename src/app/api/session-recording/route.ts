import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

const schema = z.object({
  sessionId: z.string().min(1),
  events: z.array(z.record(z.string(), z.unknown())).min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid batch" }, { status: 400 });

    // Trust, but verify: the client only sends events if it thinks the
    // user consented — this is the server actually enforcing that.
    const consent = await db.consent.findUnique({ where: { userId: session.userId } });
    if (!consent?.sessionRecordingAllowed) {
      return NextResponse.json({ error: "No recording consent on file" }, { status: 403 });
    }

    const { sessionId, events } = parsed.data;
    const timestamps = events
      .map((e) => (typeof e.timestamp === "number" ? e.timestamp : null))
      .filter((t): t is number => t !== null);
    const lastEventAt = timestamps.length ? new Date(Math.max(...timestamps)) : new Date();

    const existing = await db.sessionRecording.findUnique({ where: { id: sessionId } });

    if (existing) {
      if (existing.userId !== session.userId) {
        return NextResponse.json({ error: "Session id mismatch" }, { status: 403 });
      }
      const merged = [...JSON.parse(existing.events), ...events];
      await db.sessionRecording.update({
        where: { id: sessionId },
        data: {
          events: JSON.stringify(merged),
          endedAt: lastEventAt,
          durationMs: lastEventAt.getTime() - existing.startedAt.getTime(),
        },
      });
    } else {
      await db.sessionRecording.create({
        data: {
          id: sessionId,
          userId: session.userId,
          events: JSON.stringify(events),
          endedAt: lastEventAt,
          durationMs: 0,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("session-recording", "Ingest failed", { error: String(error) });
    // A dropped batch is not worth failing loudly over — see sendBeaconBatch.ts.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
