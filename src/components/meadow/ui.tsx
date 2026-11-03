"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useMeadowTheme } from "./MeadowScope";

/* ---------- Wordmark ---------- */
export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-serif-mw text-[24px] font-medium leading-none tracking-[-0.01em] text-ink ${className}`}
    >
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-mw-sm bg-brand text-[15px] text-on-brand">
        R
      </span>
      <span>
        ResumeRise<span className="text-brand">AI</span>
      </span>
    </Link>
  );
}

/* ---------- Buttons ---------- */
const variants = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary: "border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
  ghost: "text-brand hover:bg-brand-soft",
} as const;
const sizes = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-6 text-sm", lg: "h-[52px] px-8 text-[15px]" } as const;

type StyleProps = { variant?: keyof typeof variants; size?: keyof typeof sizes };
const cls = ({ variant = "secondary", size = "md" }: StyleProps, extra = "") =>
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-mw-md font-semibold tracking-[0.01em] transition-colors disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted ${variants[variant]} ${sizes[size]} ${extra}`;

export function MwButton({
  variant,
  size,
  className = "",
  ...props
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cls({ variant, size }, className)} {...props} />;
}

export function MwLink({
  href,
  variant,
  size,
  className = "",
  children,
}: StyleProps & { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cls({ variant, size }, className)}>
      {children}
    </Link>
  );
}

/* ---------- Badge / Card / headings ---------- */
const badgeTones = {
  neutral: "bg-surface-sunken text-ink",
  brand: "bg-brand-soft text-brand",
  lilac: "bg-lilac text-on-lilac",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  lime: "bg-lime text-on-lime",
} as const;

export function MwBadge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function MwCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-mw-lg bg-surface-raised p-5 shadow-mw-card sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({
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
        <h1 className="break-words font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ink sm:text-[40px] sm:leading-[46px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-[62ch] text-[15px] leading-[22px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function ThemeToggle() {
  const { effective, toggle } = useMeadowTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={effective === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-10 w-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
    >
      {effective === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
