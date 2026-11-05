import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { MwBadge, MwLink, PageTitle } from "@/components/meadow/ui";
import { MwEmpty, Monogram } from "@/components/meadow/blocks";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/features/jobs/lib/types";

const TONES = {
  SUBMITTED: "neutral",
  REVIEWED: "brand",
  SHORTLISTED: "success",
  REJECTED: "danger",
} as const;

export default async function MyApplicationsPage() {
  const session = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { job: { include: { company: { select: { name: true, profileJson: true } } } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="My applications" description="Jobs you have applied to and where each one stands." />

      {applications.length === 0 ? (
        <MwEmpty
          title="No applications yet"
          description="When you apply to a job, you can follow it here."
          action={
            <MwLink href="/jobs" variant="primary">
              Browse open jobs
            </MwLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => {
            const companyData = application.job.company.profileJson
              ? (JSON.parse(application.job.company.profileJson) as Record<string, string>)
              : null;
            const companyName = companyData?.companyName ?? application.job.company.name ?? "A company on Prepped";
            const status = application.status as ApplicationStatus;
            return (
              <li key={application.id}>
                <Link
                  href={`/jobs/${application.job.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-mw-lg bg-surface-raised p-5 shadow-mw-card transition-shadow hover:shadow-mw-float"
                >
                  <Monogram name={companyName} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="break-words text-[18px] font-semibold leading-6 text-ink">{application.job.title}</p>
                    <p className="text-sm text-ink-muted">
                      {companyName} · applied {application.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <MwBadge tone={TONES[status] ?? "neutral"}>{APPLICATION_STATUS_LABELS[status]}</MwBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
