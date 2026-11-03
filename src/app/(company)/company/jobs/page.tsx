import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/teamstead/ui";
import { JobActions } from "@/features/jobs/components/company/JobActions";
import { EMPLOYMENT_TYPE_LABELS, type EmploymentType, type JobStatus } from "@/features/jobs/lib/types";

export default async function CompanyJobsPage() {
  const session = await requireCompany();

  const jobs = await db.job.findMany({
    where: { companyId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Job postings"
        actions={<LinkButton href="/company/jobs/new" variant="primary">Post a job</LinkButton>}
      />

      {jobs.length === 0 ? (
        <EmptyState
          title="No job postings yet"
          description="When you create a job posting, it will appear here. Candidates on the platform can apply directly, and you can use AI to filter and shortlist resumes."
          action={<LinkButton href="/company/jobs/new" variant="primary">Create your first posting</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ts-lg border border-line bg-surface shadow-card">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-display text-[18px] font-semibold leading-6 text-ink">{job.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-muted">
                  <Badge tone={job.status === "OPEN" ? "success" : "neutral"} dot>
                    {job.status === "OPEN" ? "Open" : "Closed"}
                  </Badge>
                  <span>{EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]}</span>
                  <span className="tabular-nums">
                    {job._count.applications} applicant{job._count.applications === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
              <JobActions jobId={job.id} status={job.status as JobStatus} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
