import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { JobFilters } from "@/features/jobs/components/customer/JobFilters";
import {
  EMPLOYMENT_TYPE_LABELS,
  LOCATION_TYPE_LABELS,
  type EmploymentType,
  type LocationType,
} from "@/features/jobs/lib/types";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  await requireUser();
  const { type, q } = await searchParams;

  const jobs = await db.job.findMany({
    where: {
      status: "OPEN",
      ...(type ? { employmentType: type } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { company: { select: { name: true, profileJson: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Job opportunities</h1>
        <p className="mt-1 text-slate-600">Browse open roles and internships posted by companies on ResumeRiseAI.</p>
      </div>

      <JobFilters />

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">No open postings match your filters right now.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {jobs.map((job) => {
            const companyData = job.company.profileJson
              ? (JSON.parse(job.company.profileJson) as Record<string, string>)
              : null;
            const companyName = companyData?.companyName ?? job.company.name ?? "A company on ResumeRiseAI";
            return (
              <li key={job.id} className="px-5 py-4">
                <Link href={`/jobs/${job.id}`} className="block hover:opacity-80">
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {companyName} · {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
                    {LOCATION_TYPE_LABELS[job.locationType as LocationType]}
                    {job.pay ? ` · ${job.pay}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
