import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { CoverLetterEditor } from "@/features/cover-letters/components/CoverLetterEditor";

export default async function CoverLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const coverLetter = await db.coverLetter.findUnique({ where: { id } });
  if (!coverLetter || coverLetter.userId !== session.userId) notFound();

  return (
    <CoverLetterEditor
      coverLetterId={coverLetter.id}
      companyName={coverLetter.companyName}
      jobTitle={coverLetter.jobTitle}
      initialHtml={coverLetter.htmlContent}
    />
  );
}
