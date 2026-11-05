import { useId } from "react";

/**
 * The Prepped logo mark: a "P" whose stem doubles as a check. The gradient
 * reads its colors from --mark-edge / --mark-mid (see globals.css) so the same
 * mark works on the beige light theme and on the dark theme.
 */
export function PreppedMark({ className = "h-8 w-auto" }: { className?: string }) {
  const gradientId = `prepped-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="10 8 80 90" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="21" y1="96" x2="75" y2="8">
          <stop offset="0" style={{ stopColor: "var(--mark-edge, #2f4156)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--mark-mid, #8fa9c2)" }} />
          <stop offset="1" style={{ stopColor: "var(--mark-edge, #2f4156)" }} />
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
