import Link from "next/link";
import { MapPin, Wallet } from "lucide-react";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { MwBadge, PageTitle } from "@/components/meadow/ui";
import { MwEmpty, Monogram } from "@/components/meadow/blocks";
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
      <PageTitle
        title="Job Opportunities"
        description="Browse open jobs and internships posted by companies on Prepped."
      />

      <JobFilters />

      {jobs.length === 0 ? (
        <MwEmpty
          title="Nothing matches yet"
          description="No open postings fit those filters. Clear a filter or check back soon."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {jobs.map((job) => {
            const companyData = job.company.profileJson
              ? (JSON.parse(job.company.profileJson) as Record<string, string>)
              : null;
            const companyName = companyData?.companyName ?? job.company.name ?? "A company on Prepped";
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex h-full flex-col gap-4 rounded-mw-lg bg-surface-raised p-5 shadow-mw-card transition-shadow hover:shadow-mw-float sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <Monogram name={companyName} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[18px] font-semibold leading-6 text-ink">{job.title}</p>
                      <p className="text-[15px] text-ink-muted">{companyName}</p>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted">
                    <li className="inline-flex items-center gap-1.5">
                      <MapPin size={16} aria-hidden /> {LOCATION_TYPE_LABELS[job.locationType as LocationType]}
                    </li>
                    {job.pay && (
                      <li className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        <Wallet size={16} aria-hidden className="text-ink-muted" /> {job.pay}
                      </li>
                    )}
                  </ul>
                  <div className="mt-auto">
                    <MwBadge tone="brand">{EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]}</MwBadge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
