import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";

const updateSchema = z.object({
  htmlContent: z.string().optional(),
  title: z.string().trim().min(1).max(150).optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

async function loadOwnedResume(id: string, userId: string) {
  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.userId !== userId) return null;
  return resume;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const resume = await loadOwnedResume(id, session.userId);
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  return NextResponse.json({ resume });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedResume(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const resume = await db.resume.update({ where: { id }, data: parsed.data });
    logger.info("resume-builder", "Resume updated", { resumeId: id, userId: session.userId });
    return NextResponse.json({ resume });
  } catch (error) {
    logger.error("resume-builder", "Update resume failed", { resumeId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't save your changes. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOwnedResume(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  await db.resume.delete({ where: { id } });
  logger.info("resume-builder", "Resume deleted", { resumeId: id, userId: session.userId });
  return NextResponse.json({ ok: true });
}
