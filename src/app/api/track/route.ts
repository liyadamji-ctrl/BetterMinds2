import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/features/auth/lib/guard";
import { featureForPath } from "@/features/analytics/lib/features";
import { trackEvent } from "@/features/analytics/lib/track";

const schema = z.object({ path: z.string().max(300) });

/**
 * Records that the signed-in user opened a feature's page. The feature comes
 * from an allowlist of known paths, never from the client, so this endpoint
 * can't be used to write arbitrary rows.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });
  if (session.role === "ADMIN") return new NextResponse(null, { status: 204 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const feature = featureForPath(parsed.data.path);
  if (feature) await trackEvent({ userId: session.userId, feature, action: "view" });

  return new NextResponse(null, { status: 204 });
}
