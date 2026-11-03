import { requireCompany } from "@/features/auth/lib/guard";
import { PageHeader } from "@/components/teamstead/ui";
import { JobForm } from "@/features/jobs/components/company/JobForm";

export default async function NewJobPage() {
  await requireCompany();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Post a job"
        description="Fill in the details below. Job seekers can see it as soon as you post it."
      />
      <JobForm mode="create" />
    </div>
  );
}
