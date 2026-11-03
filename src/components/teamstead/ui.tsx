import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ---------- Badge ---------- */
const badgeTones = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-forest-soft text-forest",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  plum: "bg-plum-soft text-plum",
  match: "bg-iris-soft text-iris",
  accent: "bg-lime text-on-lime",
} as const;

export function Badge({
  tone = "neutral",
  dot,
  children,
}: {
  tone?: keyof typeof badgeTones;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${badgeTones[tone]}`}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Button (use LinkButton for navigation) ---------- */
const buttonVariants = {
  primary: "bg-forest text-on-forest hover:brightness-110",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-sunken",
  ghost: "text-ink hover:bg-surface-sunken",
  accent: "bg-lime text-on-lime hover:brightness-95",
  danger: "border border-danger bg-surface text-danger hover:bg-danger-soft",
} as const;

const buttonSizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" } as const;

type ButtonStyleProps = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

function buttonClass({ variant = "secondary", size = "md" }: ButtonStyleProps, extra = "") {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ts-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${buttonVariants[variant]} ${buttonSizes[size]} ${extra}`;
}

export function TsButton({
  variant,
  size,
  className = "",
  ...props
}: ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

export function LinkButton({
  href,
  variant,
  size,
  className = "",
  children,
}: ButtonStyleProps & { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass({ variant, size }, className)}>
      {children}
    </Link>
  );
}

/* ---------- Card / PageHeader / EmptyState / StatCard ---------- */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-ts-lg border border-line bg-surface p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words font-display text-[36px] font-bold leading-[42px] tracking-[-0.015em] text-ink max-sm:text-[28px] max-sm:leading-9">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-[68ch] text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-ts-lg border border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="font-display text-[22px] font-semibold leading-7 text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-[56ch] text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="grid gap-2">
      <p className="text-[13px] font-medium text-ink-muted">{label}</p>
      <p className="font-display text-[32px] font-semibold leading-9 tracking-[-0.01em] tabular-nums text-ink">
        {value}
      </p>
      {hint && <p className="text-xs font-medium text-ink-muted">{hint}</p>}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block min-w-0 rounded-ts-lg border border-line bg-surface px-5 py-4 shadow-card transition-colors hover:border-forest"
    >
      {body}
    </Link>
  ) : (
    <Card className="px-5 py-4">{body}</Card>
  );
}

/* ---------- Table wrapper: use <table className="ts-table"> inside ---------- */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-ts-lg border border-line bg-surface shadow-card [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_th]:whitespace-nowrap [&_th]:bg-surface-sunken [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-ink-muted [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-surface-sunken">
      {children}
    </div>
  );
}
