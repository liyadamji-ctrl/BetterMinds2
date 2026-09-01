import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/features/jobs/lib/types";

export default async function MyApplicationsPage() {
  const session = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { job: { include: { company: { select: { name: true, profileJson: true } } } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My applications</h1>
        <p className="mt-1 text-slate-600">Jobs you&rsquo;ve applied to and their current status.</p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">You haven&rsquo;t applied to any jobs yet.</p>
          <Link href="/jobs" className="mt-3 inline-block text-sm text-indigo-700 hover:underline">
            Browse open jobs
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {applications.map((application) => {
            const companyData = application.job.company.profileJson
              ? (JSON.parse(application.job.company.profileJson) as Record<string, string>)
              : null;
            const companyName = companyData?.companyName ?? application.job.company.name ?? "A company on ResumeRiseAI";
            return (
              <li key={application.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <Link href={`/jobs/${application.job.id}`} className="font-medium text-slate-900 hover:underline">
                    {application.job.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {companyName} · applied {application.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
