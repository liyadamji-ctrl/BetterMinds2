import type { ReactNode } from "react";

export function MwEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-mw-lg bg-surface-raised p-8 text-center shadow-mw-card sm:p-10">
      <p className="font-serif-mw text-[24px] font-medium leading-8 text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-[50ch] text-[15px] leading-[22px] text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Company or role initial on a sage tile, like the InternshipCard monogram. */
export function Monogram({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="grid h-12 w-12 flex-none place-items-center rounded-mw-md bg-brand-soft font-serif-mw text-[20px] text-brand"
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}
