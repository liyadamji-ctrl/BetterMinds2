import Link from "next/link";

/** Colour-coded score pill, same bands the company screening uses. */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-ink-muted">—</span>;
  const style =
    score >= 75
      ? "bg-success-soft text-success"
      : score >= 50
        ? "bg-warning-soft text-warning"
        : "bg-danger-soft text-danger";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${style}`}>{score}/100</span>;
}

export function AnalysesTabs({ active }: { active: "all" | "people" }) {
  const tab = (key: "all" | "people", href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-ts-md px-3 py-1.5 text-sm ${
        active === key ? "bg-forest text-on-forest" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex w-fit gap-1 rounded-ts-lg border border-line bg-surface p-1">
      {tab("all", "/admin/analyses", "All analyses")}
      {tab("people", "/admin/analyses/people", "By person")}
    </div>
  );
}

/** Previous/next links that keep the current filters. */
export function Pager({
  basePath,
  params,
  page,
  pages,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams({ ...params, page: String(p) });
    return `${basePath}?${qs.toString()}`;
  };
  const cls = "rounded-ts-md border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:text-ink";
  return (
    <div className="flex items-center justify-between text-sm text-ink-muted">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={cls}>
            ← Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={cls}>
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
