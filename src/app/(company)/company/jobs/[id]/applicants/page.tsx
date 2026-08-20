import { notFound } from "next/navigation";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { ApplicantsList, type ApplicantRow } from "@/features/jobs/components/company/ApplicantsList";
import type { ApplicationStatus } from "@/features/jobs/lib/types";

export default async function JobApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;

  const job = await db.job.findUnique({ where: { id } });
  if (!job || job.companyId !== session.userId) notFound();

  const applications = await db.application.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    include: { user: true, resume: true },
  });

  const applicants: ApplicantRow[] = applications.map((app) => ({
    id: app.id,
    applicantName: app.user.name,
    applicantEmail: app.user.email,
    note: app.note,
    status: app.status as ApplicationStatus,
    createdAt: app.createdAt.toISOString(),
    resumeTitle: app.resume.title,
    resumeHtml: app.resume.htmlContent,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Applicants — {job.title}</h1>
      </div>
      <ApplicantsList initialApplicants={applicants} />
    </div>
  );
}
