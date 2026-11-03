import Link from "next/link";
import {
  SCORE_BANDS,
  SCORE_BAND_LABELS,
  getAnalysisList,
  getAnalysisOverview,
  parseFilters,
} from "@/features/analytics/lib/analysisAdmin";
import { AnalysesTabs, Pager, ScoreBadge } from "@/features/analytics/components/AnalysisParts";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-ts-lg border border-line bg-surface p-5">
      <p className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

const input =
  "rounded-ts-md border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-forest";

export default async function AdminAnalysesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const [overview, list] = await Promise.all([getAnalysisOverview(), getAnalysisList(filters)]);
  const filtered = filters.q !== "" || filters.band !== "all" || filters.from !== "" || filters.to !== "";

  const pagerParams: Record<string, string> = {};
  if (filters.q) pagerParams.q = filters.q;
  if (filters.band !== "all") pagerParams.band = filters.band;
  if (filters.from) pagerParams.from = filters.from;
  if (filters.to) pagerParams.to = filters.to;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">Resume analyses</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every resume customers have run through the Resume Analyzer, who ran it, and the job they analysed it against.
          One person can appear many times, once per job.
        </p>
      </div>

      <AnalysesTabs active="all" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Analyses run" value={overview.total} />
        <StatCard label="People" value={overview.people} />
        <StatCard label="Average score" value={overview.avgScore ?? "—"} />
        <StatCard label="Scored below 50" value={overview.below50} />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-ts-lg border border-line bg-surface p-4">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-ink-muted">
          Search person, email, file or job
          <input name="q" defaultValue={filters.q} placeholder="e.g. frontend, priya@…" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Score
          <select name="band" defaultValue={filters.band} className={input}>
            {SCORE_BANDS.map((b) => (
              <option key={b} value={b}>
                {SCORE_BAND_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          From
          <input type="date" name="from" defaultValue={filters.from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          To
          <input type="date" name="to" defaultValue={filters.to} className={input} />
        </label>
        <button type="submit" className="rounded-ts-md bg-forest px-4 py-2 text-sm font-medium text-on-forest hover:brightness-110">
          Apply
        </button>
        {filtered && (
          <Link href="/admin/analyses" className="px-2 py-2 text-sm text-ink-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-ink-muted">
        {list.total} {list.total === 1 ? "analysis" : "analyses"}
        {filtered ? " match these filters" : ""}
      </p>

      {list.rows.length === 0 ? (
        <p className="text-ink-muted">{filtered ? "Nothing matches those filters." : "No analyses have been run yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-ts-lg border border-line">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Resume file</th>
                <th className="px-4 py-3 font-medium">Analysed against job</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {list.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/analyses/people/${row.userId}`} className="font-medium text-ink hover:text-forest">
                      {row.personName}
                    </Link>
                    <p className="text-xs text-ink-muted">{row.personEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{row.fileName ?? <span className="text-ink-muted">Pasted text</span>}</td>
                  <td className="px-4 py-3 text-ink">{row.jobTitle}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={row.matchScore} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.createdAt.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/analyses/${row.id}`} className="text-forest hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager basePath="/admin/analyses" params={pagerParams} page={filters.page} pages={list.pages} />
    </div>
  );
}
