import { NextResponse } from "next/server";
import { getSession } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";

/**
 * POST /api/profile
 * Updates the current user's profile. Used by the onboarding wizard.
 * Any field omitted is left unchanged.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const { role, profileData, needsOnboarding } = body as {
    role?: string;
    profileData?: Record<string, unknown>;
    needsOnboarding?: boolean;
  };

  // Admins cannot change their own role via this endpoint.
  const allowedRoles = ["CUSTOMER", "COMPANY"];
  const safeRole =
    role && allowedRoles.includes(role) && session.role !== "ADMIN" ? role : undefined;

  await db.profile.update({
    where: { id: session.userId },
    data: {
      ...(safeRole !== undefined && { role: safeRole }),
      ...(profileData !== undefined && { profileJson: JSON.stringify(profileData) }),
      ...(needsOnboarding !== undefined && { needsOnboarding }),
    },
  });

  return NextResponse.json({ ok: true });
}
