import { useId } from "react";

/**
 * The Prepped logo mark: a "P" whose stem doubles as a check. The gradient
 * runs from the site navy (--navy) at the edges to --mark-mid in the middle
 * (see globals.css), so it matches the wordmark in both themes. The viewBox
 * is cropped to the stroke's real edges, so the bottom of the box is the
 * bottom of the mark; size it to the text's cap height in an `items-baseline` row.
 */
export function PreppedMark({ className = "h-[0.7em] w-auto" }: { className?: string }) {
  const gradientId = `prepped-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="14.5 11.5 71 81" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="21" y1="96" x2="75" y2="8">
          <stop offset="0" style={{ stopColor: "var(--navy, #2f4156)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--mark-mid, #8fa9c2)" }} />
          <stop offset="1" style={{ stopColor: "var(--navy, #2f4156)" }} />
        </linearGradient>
      </defs>
      <g transform="translate(1 2)">
        <path
          d="M19 60 L32 85 L47 15 H59 A20 20 0 0 1 59 55 H40"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
