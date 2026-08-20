import Link from "next/link";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Job postings</h1>
        <Link href="/company/jobs/new">
          <Button>Post a job</Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No job postings yet</p>
          <p className="mt-1 text-sm text-slate-500">
            When you create a job posting, it will appear here. Candidates on the platform can
            apply directly, and you can use AI to filter and shortlist resumes.
          </p>
          <Link href="/company/jobs/new" className="mt-4 inline-block">
            <Button variant="secondary">Create your first posting</Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium text-slate-900">{job.title}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
                  <span className={job.status === "OPEN" ? "text-green-700" : "text-slate-500"}>
                    {job.status === "OPEN" ? "Open" : "Closed"}
                  </span>{" "}
                  · {job._count.applications} applicant{job._count.applications === 1 ? "" : "s"}
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
