import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { trackEvent } from "@/features/analytics/lib/track";
import { suggestKeywords } from "@/features/discovery/lib/keywords";

// Past searches kept per customer per page; older ones are dropped.
const MAX_SAVED_PER_KIND = 30;

const createSchema = z.object({
  kind: z.enum(["PROGRAM", "INTERNSHIP"]),
  query: z.string().trim().min(2, "Enter at least 2 characters").max(100),
  area: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  level: z.enum(["", "beginner", "intermediate", "advanced"]).optional(),
  freeOnly: z.boolean().optional(),
  remote: z.boolean().optional(),
  jobType: z.enum(["internship", "job"]).optional(),
  useAi: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { kind, query, useAi, ...filters } = parsed.data;

    const { keywords, aiUsed } = useAi
      ? await suggestKeywords(kind, query, filters.area ?? "")
      : { keywords: [query], aiUsed: false };

    const saved = await db.discoverySearch.create({
      data: {
        userId: session.userId,
        kind,
        query,
        filtersJson: JSON.stringify(filters),
        keywordsJson: JSON.stringify(keywords),
      },
    });

    await trackEvent({
      userId: session.userId,
      feature: kind === "PROGRAM" ? "programs" : "internships",
      action: "search_saved",
      metadata: { aiUsed },
    });

    // Trim old history for this page.
    const stale = await db.discoverySearch.findMany({
      where: { userId: session.userId, kind },
      orderBy: { createdAt: "desc" },
      skip: MAX_SAVED_PER_KIND,
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.discoverySearch.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }

    return NextResponse.json({
      id: saved.id,
      createdAt: saved.createdAt.toISOString(),
      keywords,
      aiUsed,
    });
  } catch (error) {
    logger.error("discovery", "Saving search failed", { error: String(error) });
    return NextResponse.json({ error: "Couldn't run that search right now. Please try again." }, { status: 500 });
  }
}
