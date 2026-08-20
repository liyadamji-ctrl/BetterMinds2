import Link from "next/link";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";

export default async function CompanyDashboardPage() {
  const session = await requireCompany();

  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { name: true, profileJson: true },
  });

  const profileData = profile?.profileJson
    ? (JSON.parse(profile.profileJson) as Record<string, string>)
    : null;

  const companyName = profileData?.companyName ?? profile?.name ?? "Your Company";

  const [activeJobs, totalApplicants, shortlisted, totalJobs] = await Promise.all([
    db.job.count({ where: { companyId: session.userId, status: "OPEN" } }),
    db.application.count({ where: { job: { companyId: session.userId } } }),
    db.application.count({ where: { job: { companyId: session.userId }, status: "SHORTLISTED" } }),
    db.job.count({ where: { companyId: session.userId } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {companyName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your job postings and review candidate applications from here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-3xl font-bold text-slate-900">{activeJobs}</p>
          <p className="mt-1 text-sm text-slate-500">Active job postings</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-3xl font-bold text-slate-900">{totalApplicants}</p>
          <p className="mt-1 text-sm text-slate-500">Total applicants</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-3xl font-bold text-slate-900">{shortlisted}</p>
          <p className="mt-1 text-sm text-slate-500">Shortlisted candidates</p>
        </div>
      </div>

      {totalJobs === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No job postings yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create your first job posting to start receiving applications from candidates on Focal.
          </p>
          <Link href="/company/jobs/new" className="mt-4 inline-block">
            <Button>Post a job</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
