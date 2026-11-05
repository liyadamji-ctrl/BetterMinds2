import Link from "next/link";
import { getCompanies } from "@/features/analytics/lib/companyStats";
import { MIN_DECISIONS } from "@/features/analytics/lib/aiEffectiveness";
import { VerdictBadge } from "@/features/analytics/components/VerdictBadge";

export default async function AdminCompaniesPage() {
  const companies = await getCompanies();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ocean sm:text-[36px] sm:leading-[42px]">Companies</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every company on the platform and whether AI screening is giving them results they agree with. The AI
          &ldquo;agrees&rdquo; when a recruiter shortlists a Strong or Possible match, or rejects a Weak one. Results are
          shown once a company has made at least {MIN_DECISIONS} decisions on screened applicants.
        </p>
      </div>

      {companies.length === 0 ? (
        <p className="text-ink-muted">No companies yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-ts-lg border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 text-right font-medium">Jobs</th>
                <th className="px-4 py-3 text-right font-medium">Applicants</th>
                <th className="px-4 py-3 text-right font-medium">AI Screened</th>
                <th className="px-4 py-3 text-right font-medium">Avg Score</th>
                <th className="px-4 py-3 text-right font-medium">Agreement</th>
                <th className="px-4 py-3 font-medium">AI Verdict</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-muted">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {c.jobs}
                    {c.jobs > 0 && <span className="text-xs text-ink-muted"> ({c.openJobs} open)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{c.ai.applicants}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {c.ai.screened}
                    {c.ai.adoptionRate !== null && <span className="text-xs text-ink-muted"> ({c.ai.adoptionRate}%)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{c.ai.avgScore ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {c.ai.agreementRate !== null ? `${c.ai.agreementRate}%` : "—"}
                    {c.ai.decided > 0 && <span className="text-xs text-ink-muted"> ({c.ai.decided})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge verdict={c.ai.verdict} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/companies/${c.id}`} className="text-navy hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
