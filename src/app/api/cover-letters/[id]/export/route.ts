import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/features/auth/lib/guard";
import { buildCoverLetterDocx } from "@/features/cover-letters/lib/exportDocx";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const coverLetter = await db.coverLetter.findUnique({ where: { id } });
  if (!coverLetter || coverLetter.userId !== session.userId) {
    return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
  }

  const type = new URL(request.url).searchParams.get("type");
  if (type !== "docx") {
    return NextResponse.json({ error: "Only ?type=docx is supported here." }, { status: 400 });
  }

  try {
    const title = `Cover letter — ${coverLetter.jobTitle} at ${coverLetter.companyName}`;
    const buffer = await buildCoverLetterDocx(coverLetter.htmlContent, title);
    const filename = `${title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "cover-letter"}.docx`;

    logger.info("cover-letters", "Cover letter exported as docx", {
      coverLetterId: id,
      userId: session.userId,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error("cover-letters", "Docx export failed", { coverLetterId: id, error: String(error) });
    return NextResponse.json({ error: "Couldn't generate the Word file. Please try again." }, { status: 500 });
  }
}
