import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { ApplyButton } from "@/features/jobs/components/customer/ApplyButton";
import {
  EMPLOYMENT_TYPE_LABELS,
  LOCATION_TYPE_LABELS,
  type EmploymentType,
  type LocationType,
  type ApplicationStatus,
} from "@/features/jobs/lib/types";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const job = await db.job.findUnique({
    where: { id },
    include: { company: { select: { name: true, profileJson: true } } },
  });
  if (!job) notFound();

  const [resumes, existingApplication] = await Promise.all([
    db.resume.findMany({
      where: { userId: session.userId },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.application.findUnique({ where: { jobId_userId: { jobId: id, userId: session.userId } } }),
  ]);

  const companyData = job.company.profileJson
    ? (JSON.parse(job.company.profileJson) as Record<string, string>)
    : null;
  const companyName = companyData?.companyName ?? job.company.name ?? "A company on ResumeRiseAI";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
        <p className="mt-1 text-slate-600">{companyName}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
          {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType]} ·{" "}
          {LOCATION_TYPE_LABELS[job.locationType as LocationType]}
          {job.location ? ` · ${job.location}` : ""}
          {job.hoursPerWeek ? ` · ${job.hoursPerWeek} hrs/week` : ""}
          {job.weeksPerYear ? ` · ${job.weeksPerYear} weeks/year` : ""}
          {job.pay ? ` · ${job.pay}` : ""}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold text-slate-900">About this role</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
      </div>

      {job.requirements && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 font-semibold text-slate-900">Requirements</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{job.requirements}</p>
        </div>
      )}

      {job.status === "OPEN" ? (
        <ApplyButton
          jobId={job.id}
          resumes={resumes}
          initialStatus={existingApplication ? (existingApplication.status as ApplicationStatus) : null}
        />
      ) : (
        <p className="text-sm text-slate-500">This posting is closed and no longer accepting applications.</p>
      )}

      <Link href={`/cover-letters/new?jobId=${job.id}`} className="text-sm text-indigo-700 hover:underline">
        Write a cover letter for this job
      </Link>
    </div>
  );
}
