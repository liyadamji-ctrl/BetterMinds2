import { requireCompany } from "@/features/auth/lib/guard";
import { JobForm } from "@/features/jobs/components/company/JobForm";

export default async function NewJobPage() {
  await requireCompany();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Post a job</h1>
        <p className="mt-1 text-slate-600">
          Fill in the details below — it&rsquo;ll be visible to job seekers once posted.
        </p>
      </div>
      <JobForm mode="create" />
    </div>
  );
}
