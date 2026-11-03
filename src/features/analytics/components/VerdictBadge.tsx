import { VERDICT_LABELS, type Verdict } from "../lib/aiEffectiveness";

const STYLES: Record<Verdict, string> = {
  WORKING_WELL: "bg-success-soft text-success",
  MIXED: "bg-warning-soft text-warning",
  NOT_WORKING: "bg-danger-soft text-danger",
  NOT_ENOUGH_DATA: "bg-surface-sunken text-ink",
  NOT_USED: "bg-surface-sunken text-ink-muted",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[verdict]}`}>
      {VERDICT_LABELS[verdict]}
    </span>
  );
}
