import Link from "next/link";
import { requireCompany } from "@/features/auth/lib/guard";
import { Button } from "@/components/ui/Button";

export default async function CompanyJobsPage() {
  await requireCompany();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Job postings</h1>
        <Link href="/company/jobs/new">
          <Button>Post a job</Button>
        </Link>
      </div>

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
    </div>
  );
}
