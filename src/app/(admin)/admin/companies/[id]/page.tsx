import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyDetail } from "@/features/analytics/lib/companyStats";
import { MIN_DECISIONS, type ScreeningSummary } from "@/features/analytics/lib/aiEffectiveness";
import { VerdictBadge } from "@/features/analytics/components/VerdictBadge";
import { EMPLOYMENT_TYPE_LABELS, type EmploymentType } from "@/features/jobs/lib/types";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-ts-lg border border-line bg-surface p-4">
      <p className="text-xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Plain-language explanation of why a company got its verdict. */
function explain(ai: ScreeningSummary): string {
  switch (ai.verdict) {
    case "NOT_USED":
      return ai.applicants === 0
        ? "No applicants yet, so there is nothing to screen."
        : "This company has applicants but has never run AI screening.";
    case "NOT_ENOUGH_DATA":
      return `Only ${ai.decided} screened applicant${ai.decided === 1 ? " has" : "s have"} been shortlisted or rejected so far. Need ${MIN_DECISIONS} to judge.`;
    case "WORKING_WELL":
      return `Recruiters agreed with the AI on ${ai.agreed} of ${ai.decided} decisions.`;
    case "MIXED":
      return `Recruiters agreed with the AI on ${ai.agreed} of ${ai.decided} decisions. Worth reviewing the disagreements below.`;
    case "NOT_WORKING":
      return `Recruiters disagreed with the AI on most decisions (${ai.agreed} of ${ai.decided} matched). The job description or requirements may be too vague, or the prompt needs tuning.`;
  }
}

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCompanyDetail(id);
  if (!detail) notFound();
  const { company, overall, jobs } = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/companies" className="text-sm text-forest hover:underline">
          ← All companies
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">{company.name}</h1>
          <VerdictBadge verdict={overall.verdict} />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {company.email}
          {company.industry ? ` · ${company.industry}` : ""}
          {company.location ? ` · ${company.location}` : ""} · joined {company.joinedAt.toLocaleDateString()}
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-ts-lg border border-line bg-surface p-5">
        <div>
          <h2 className="font-semibold text-ink">How AI screening is working for them</h2>
          <p className="mt-1 text-sm text-ink-muted">{explain(overall)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Applicants screened" value={`${overall.screened} / ${overall.applicants}`} hint={overall.adoptionRate !== null ? `${overall.adoptionRate}% adoption` : undefined} />
          <Stat label="Average AI score" value={overall.avgScore ?? "—"} hint={`${overall.strong} strong · ${overall.possible} possible · ${overall.weak} weak`} />
          <Stat label="Recruiter agreement" value={overall.agreementRate !== null ? `${overall.agreementRate}%` : "—"} hint={`${overall.decided} shortlisted/rejected decisions`} />
          <Stat label="Overrides" value={overall.strongRejected + overall.weakShortlisted} hint={`${overall.strongRejected} strong rejected · ${overall.weakShortlisted} weak shortlisted`} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink">Job postings ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p className="text-ink-muted">This company has not posted any jobs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-ts-lg border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-surface text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 text-right font-medium">Applicants</th>
                  <th className="px-4 py-3 text-right font-medium">Screened</th>
                  <th className="px-4 py-3 text-right font-medium">Avg score</th>
                  <th className="px-4 py-3 text-right font-medium">Strong / Possible / Weak</th>
                  <th className="px-4 py-3 text-right font-medium">Shortlisted / Rejected</th>
                  <th className="px-4 py-3 text-right font-medium">Agreement</th>
                  <th className="px-4 py-3 font-medium">AI verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{job.title}</p>
                      <p className="text-xs text-ink-muted">
                        {EMPLOYMENT_TYPE_LABELS[job.employmentType as EmploymentType] ?? job.employmentType} ·{" "}
                        {job.status === "OPEN" ? "Open" : "Closed"} · posted {job.createdAt.toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{job.ai.applicants}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{job.ai.screened}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{job.ai.avgScore ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {job.ai.strong} / {job.ai.possible} / {job.ai.weak}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {job.ai.shortlisted} / {job.ai.rejected}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {job.ai.agreementRate !== null ? `${job.ai.agreementRate}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={job.ai.verdict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-ink-muted">
        Admin view shows counts only. Applicant names, resumes and AI summaries are not shown here.
      </p>
    </div>
  );
}
