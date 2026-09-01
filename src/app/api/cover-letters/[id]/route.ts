import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

const updateSchema = z.object({
  htmlContent: z.string().min(1),
});

async function loadOwnedCoverLetter(id: string, userId: string) {
  const coverLetter = await db.coverLetter.findUnique({ where: { id } });
  if (!coverLetter || coverLetter.userId !== userId) return null;
  return coverLetter;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const coverLetter = await loadOwnedCoverLetter(id, session.userId);
  if (!coverLetter) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

  return NextResponse.json({ coverLetter });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedCoverLetter(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const coverLetter = await db.coverLetter.update({ where: { id }, data: parsed.data });
    logger.info("cover-letters", "Cover letter updated", { coverLetterId: id, userId: session.userId });
    return NextResponse.json({ coverLetter });
  } catch (error) {
    logger.error("cover-letters", "Update cover letter failed", { coverLetterId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedCoverLetter(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

  await db.coverLetter.delete({ where: { id } });
  logger.info("cover-letters", "Cover letter deleted", { coverLetterId: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}
