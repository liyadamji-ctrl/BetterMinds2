import { NextResponse } from "next/server";
import { getSession } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";

/** Used right after login to decide where to redirect. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { needsOnboarding: true },
  });

  return NextResponse.json({
    role: session.role,
    needsOnboarding: profile?.needsOnboarding ?? false,
  });
}
