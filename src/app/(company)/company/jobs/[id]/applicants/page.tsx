import { notFound } from "next/navigation";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/teamstead/ui";
import { ApplicantsList, type ApplicantRow } from "@/features/jobs/components/company/ApplicantsList";
import type { ApplicationStatus } from "@/features/jobs/lib/types";
import { parseScreeningResult, type ScreeningResult } from "@/features/screening/lib/screeningSchema";

/** Stored JSON is ours, but never let one bad row crash the page. */
function readScreening(json: string | null): ScreeningResult | null {
  if (!json) return null;
  try {
    return parseScreeningResult(JSON.parse(json));
  } catch {
    return null;
  }
}

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
    matchScore: app.matchScore,
    screening: readScreening(app.screeningJson),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Applicants for ${job.title}`} />
      <ApplicantsList jobId={job.id} initialApplicants={applicants} />
    </div>
  );
}
