import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { buildResumeDocx } from "@/features/resume-builder/lib/exportDocx";
import type { ResumeAnswers } from "@/features/resume-builder/formats/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.userId !== session.userId) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const type = new URL(request.url).searchParams.get("type");
  if (type !== "docx") {
    return NextResponse.json({ error: "Only ?type=docx is supported here — PDF exports client-side." }, { status: 400 });
  }

  try {
    const answers = JSON.parse(resume.fieldsJson) as ResumeAnswers;
    const buffer = await buildResumeDocx(answers, resume.title);
    const filename = `${resume.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "resume"}.docx`;

    logger.info("resume-builder", "Resume exported as docx", { resumeId: id, userId: session.userId });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error("resume-builder", "Docx export failed", { resumeId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't generate the Word file. Please try again." }, { status: 500 });
  }
}
