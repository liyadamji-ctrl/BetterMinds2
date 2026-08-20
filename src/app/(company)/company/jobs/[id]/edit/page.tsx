import { notFound } from "next/navigation";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { JobForm, type JobFormInitial } from "@/features/jobs/components/company/JobForm";
import type { EmploymentType, LocationType } from "@/features/jobs/lib/types";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;

  const job = await db.job.findUnique({ where: { id } });
  if (!job || job.companyId !== session.userId) notFound();

  const initial: JobFormInitial = {
    id: job.id,
    title: job.title,
    description: job.description,
    requirements: job.requirements,
    employmentType: job.employmentType as EmploymentType,
    hoursPerWeek: job.hoursPerWeek,
    weeksPerYear: job.weeksPerYear,
    pay: job.pay,
    location: job.location,
    locationType: job.locationType as LocationType,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit job posting</h1>
      </div>
      <JobForm mode="edit" job={initial} />
    </div>
  );
}
