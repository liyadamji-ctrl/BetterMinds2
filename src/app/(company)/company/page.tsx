import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { EmptyState, LinkButton, PageHeader, StatCard } from "@/components/teamstead/ui";

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
      <PageHeader
        title={`Welcome, ${companyName}`}
        description="Manage your job postings and review candidate applications from here."
        actions={<LinkButton href="/company/jobs/new" variant="primary">Post a Job</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active Job Postings" value={activeJobs} href="/company/jobs" />
        <StatCard label="Total Applicants" value={totalApplicants} />
        <StatCard label="Shortlisted Candidates" value={shortlisted} />
      </div>

      {totalJobs === 0 && (
        <EmptyState
          title="No job postings yet"
          description="Create your first job posting to start receiving applications from candidates on Prepped."
          action={<LinkButton href="/company/jobs/new" variant="primary">Post a Job</LinkButton>}
        />
      )}
    </div>
  );
}
