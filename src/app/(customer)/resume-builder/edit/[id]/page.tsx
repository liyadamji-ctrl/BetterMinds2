import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { ResumeEditor } from "@/features/resume-builder/components/ResumeEditor";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export default async function EditResumePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const resume = await db.resume.findUnique({ where: { id } });
  if (!resume || resume.userId !== session.userId) notFound();

  return (
    <AppErrorBoundary scope="resume-builder:editor">
      <ResumeEditor resumeId={resume.id} title={resume.title} initialHtml={resume.htmlContent} />
    </AppErrorBoundary>
  );
}
