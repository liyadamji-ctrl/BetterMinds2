import Link from "next/link";
import { getFeatureUsage, parseRange, RANGES, type Range } from "@/features/analytics/lib/featureUsage";

const RANGE_LABELS: Record<Range, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-ts-lg border border-line bg-surface p-5">
      <p className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Change({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <span className="text-ink-muted">—</span>;
  if (previous === 0) return current > 0 ? <span className="text-success">new</span> : <span className="text-ink-muted">—</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-ink-muted">0%</span>;
  return <span className={pct > 0 ? "text-success" : "text-danger"}>{pct > 0 ? `+${pct}%` : `${pct}%`}</span>;
}

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

export default async function AdminFeaturesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const report = await getFeatureUsage(range);
  const max = Math.max(1, ...report.rows.map((r) => r.uses));
  const top = report.rows[0] && report.rows[0].uses > 0 ? report.rows[0] : null;
  const aiUses = report.rows.filter((r) => r.feature.usesAi).reduce((sum, r) => sum + r.uses, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">Feature usage</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every feature on the platform, most used first. A &ldquo;use&rdquo; is someone completing the
            feature&apos;s main action, not just opening the page.
          </p>
        </div>
        <div className="flex gap-1 rounded-ts-lg border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/features?range=${r}`}
              className={`rounded-ts-md px-3 py-1.5 text-sm ${
                r === range ? "bg-forest text-on-forest" : "text-ink-muted hover:text-ink"
              }`}
            >
              {RANGE_LABELS[r]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total feature uses" value={report.totalUses} hint={RANGE_LABELS[range]} />
        <StatCard label="Active users" value={report.activeUsers} hint="Users with any activity in range" />
        <StatCard
          label="Most used feature"
          value={top ? top.feature.label : "—"}
          hint={top ? `${top.uses} uses · ${aiUses} AI-powered uses overall` : "No activity in this range yet"}
        />
      </div>

      <div className="overflow-x-auto rounded-ts-lg border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Feature</th>
              <th className="w-48 px-4 py-3 font-medium">Uses</th>
              <th className="px-4 py-3 text-right font-medium">Users</th>
              <th className="px-4 py-3 text-right font-medium">Page opens</th>
              <th className="px-4 py-3 text-right font-medium">vs previous</th>
              <th className="px-4 py-3 font-medium">Last used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {report.rows.map((row, i) => (
              <tr key={row.feature.id}>
                <td className="px-4 py-3 text-ink-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {row.feature.label}{" "}
                    <span className="ml-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">
                      {row.feature.audience}
                    </span>
                    {row.feature.usesAi && (
                      <span className="ml-1 rounded bg-forest-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-forest">
                        AI
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">{row.feature.description}</p>
                  {row.otherActions.length > 0 && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Also: {row.otherActions.map((a) => `${formatAction(a.action)} ${a.count}`).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-surface-sunken">
                      <div
                        className="h-2 rounded-full bg-forest"
                        style={{ width: `${Math.round((row.uses / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums text-ink">{row.uses}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{row.uniqueUsers}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">{row.opens}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <Change current={row.uses} previous={row.previousUses} />
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.lastUsed ? row.lastUsed.toLocaleDateString() : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        History from before tracking was added was filled in from existing records, so it shows main actions only (no
        page opens).
      </p>
    </div>
  );
}
