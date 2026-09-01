import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { CoverLetterForm } from "@/features/cover-letters/components/CoverLetterForm";

function companyNameFor(company: { name: string | null; profileJson: string | null }) {
  const companyData = company.profileJson ? (JSON.parse(company.profileJson) as Record<string, string>) : null;
  return companyData?.companyName ?? company.name ?? "the company";
}

export default async function NewCoverLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const session = await requireUser();
  const { jobId } = await searchParams;

  const [resumes, applications, prefillJobRow] = await Promise.all([
    db.resume.findMany({
      where: { userId: session.userId },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.application.findMany({
      where: { userId: session.userId },
      include: { job: { include: { company: { select: { name: true, profileJson: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    jobId
      ? db.job.findUnique({
          where: { id: jobId },
          include: { company: { select: { name: true, profileJson: true } } },
        })
      : Promise.resolve(null),
  ]);

  const applicationOptions = applications.map((application) => ({
    jobId: application.job.id,
    jobTitle: application.job.title,
    companyName: companyNameFor(application.job.company),
  }));

  const prefillJob = prefillJobRow
    ? {
        jobId: prefillJobRow.id,
        jobTitle: prefillJobRow.title,
        companyName: companyNameFor(prefillJobRow.company),
      }
    : null;

  const invalidJobId = Boolean(jobId) && !prefillJobRow;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New cover letter</h1>
        <p className="mt-1 text-slate-600">
          Pick a resume and a job — we&rsquo;ll write a first draft you can review and edit.
        </p>
      </div>
      <CoverLetterForm
        resumes={resumes}
        applications={applicationOptions}
        prefillJob={prefillJob}
        invalidJobId={invalidJobId}
      />
    </div>
  );
}
