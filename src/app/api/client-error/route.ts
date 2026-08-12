import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scope = typeof body.scope === "string" ? body.scope : "unknown-client";
    logger.error(`client:${scope}`, body.message ?? "Unhandled client error", {
      stack: body.stack,
      componentStack: body.componentStack,
    });
  } catch {
    // Malformed payload — nothing useful to log, don't throw.
  }
  return NextResponse.json({ ok: true });
}
