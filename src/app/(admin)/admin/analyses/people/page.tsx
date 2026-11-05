import Link from "next/link";
import { getPeople } from "@/features/analytics/lib/analysisAdmin";
import { AnalysesTabs, Pager, ScoreBadge } from "@/features/analytics/components/AnalysisParts";

const input =
  "rounded-ts-md border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-navy";

export default async function AdminAnalysisPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = (typeof raw.q === "string" ? raw.q : "").trim().slice(0, 100);
  const pageNum = Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
  const people = await getPeople(q, page);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ocean sm:text-[36px] sm:leading-[42px]">Resume analyses by person</h1>
        <p className="mt-1 text-sm text-ink-muted">
          One row per customer. Open a person to see every job they analysed a resume against.
        </p>
      </div>

      <AnalysesTabs active="people" />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-ink-muted">
          Search name or email
          <input name="q" defaultValue={q} className={input} />
        </label>
        <button type="submit" className="rounded-ts-md bg-navy px-4 py-2 text-sm font-medium text-on-navy hover:brightness-110">
          Search
        </button>
        {q && (
          <Link href="/admin/analyses/people" className="px-2 py-2 text-sm text-ink-muted hover:text-ink">
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-ink-muted">
        {people.total} {people.total === 1 ? "person" : "people"}
      </p>

      {people.rows.length === 0 ? (
        <p className="text-ink-muted">{q ? "No one matches that search." : "No analyses have been run yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-ts-lg border border-line">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 text-right font-medium">Analyses</th>
                <th className="px-4 py-3 text-right font-medium">Different jobs</th>
                <th className="px-4 py-3 font-medium">Avg score</th>
                <th className="px-4 py-3 font-medium">Last analysis</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {people.rows.map((p) => (
                <tr key={p.userId}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-muted">{p.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{p.analyses}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">{p.distinctJobs}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={p.avgScore} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{p.lastAt.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/analyses/people/${p.userId}`} className="text-navy hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager basePath="/admin/analyses/people" params={q ? { q } : {}} page={page} pages={people.pages} />
    </div>
  );
}
