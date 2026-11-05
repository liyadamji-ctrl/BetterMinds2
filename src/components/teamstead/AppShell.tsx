"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  Briefcase,
  Building2,
  FileSearch,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  PlayCircle,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PreppedMark } from "@/components/PreppedMark";
import { teamsteadFontClasses } from "./fonts";

const ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  briefcase: Briefcase,
  chart: BarChart3,
  building: Building2,
  analysis: FileSearch,
  recording: PlayCircle,
};

export type NavEntry = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

type Theme = "light" | "dark";
const STORAGE_KEY = "ts-theme";

export function AppShell({
  nav,
  homeHref,
  badge,
  children,
}: {
  nav: NavEntry[];
  homeHref: string;
  /** Shown beside the wordmark, e.g. "Admin". */
  badge?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [osDark, setOsDark] = useState(false);
  const [open, setOpen] = useState(false);

  // theme null = follow the OS; the saved choice wins once the user picks.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
    setOsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Close the drawer with Escape and stop the page scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const effective: Theme = theme ?? (osDark ? "dark" : "light");

  function toggleTheme() {
    const next: Theme = effective === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <Link
          href={homeHref}
          className="flex items-center gap-2 font-display text-[22px] font-bold tracking-[-0.01em] text-ocean"
        >
          <PreppedMark className="h-[1.1em] w-auto flex-none" />
          Prepped
        </Link>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-ts-md text-ink hover:bg-surface-sunken lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>
      {badge && (
        <span className="-mt-3 w-fit rounded-full bg-seafoam px-2.5 py-0.5 text-xs font-semibold text-on-seafoam">
          {badge}
        </span>
      )}
      <nav aria-label="Main" className="flex flex-col gap-1">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-2.5 rounded-ts-md px-3 text-sm transition-colors ${
                active
                  ? "bg-mist font-semibold text-navy"
                  : "font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={logout}
        className="mt-auto flex h-10 items-center gap-2.5 rounded-ts-md px-3 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
      >
        <LogOut size={18} strokeWidth={1.75} aria-hidden />
        Log out
      </button>
    </div>
  );

  return (
    <div className={`theme-teamstead min-h-screen ${teamsteadFontClasses}`} data-theme={theme ?? undefined}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface shadow-pop">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-60">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-ts-md border border-line bg-surface text-ink hover:bg-surface-sunken lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-ts-md border border-line bg-surface text-ink hover:bg-surface-sunken"
            aria-label={effective === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {effective === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
