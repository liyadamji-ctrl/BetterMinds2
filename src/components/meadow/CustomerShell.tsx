"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MeadowScope } from "./MeadowScope";
import { ThemeToggle, Wordmark } from "./ui";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: NavLink[] };
type NavEntry = NavLink | NavGroup;

const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "Find work",
    items: [
      { href: "/jobs", label: "Jobs" },
      { href: "/internships", label: "Internships" },
      { href: "/programs", label: "Programs" },
      { href: "/jobs/applications", label: "My applications" },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/resume-builder", label: "New resume" },
      { href: "/resume-analyzer", label: "Analyze resume" },
      { href: "/cover-letters", label: "Cover letters" },
    ],
  },
  { href: "/interview", label: "Interview" },
];

const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

/** The longest matching href wins, so /jobs/applications does not also light up /jobs. */
function activeHref(pathname: string): string | null {
  const all = NAV.flatMap((e) => (isGroup(e) ? e.items : [e]));
  const hits = all.filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"));
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

const linkBase = "rounded-mw-md px-3 py-2 text-sm font-medium transition-colors";

function GroupMenu({ group, active }: { group: NavGroup; active: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const groupActive = group.items.some((i) => i.href === active);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`${linkBase} inline-flex items-center gap-1 ${
          groupActive ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
        }`}
      >
        {group.label}
        <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-40 mt-2 min-w-48 rounded-mw-lg bg-surface-raised p-2 shadow-mw-float">
          {group.items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.href === active ? "page" : undefined}
                className={`block rounded-mw-md px-3 py-2 text-sm font-medium ${
                  item.href === active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface-sunken"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = activeHref(pathname);

  useEffect(() => setOpen(false), [pathname]);
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

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <MeadowScope>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Wordmark href="/dashboard" />
            <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
              {NAV.map((entry) =>
                isGroup(entry) ? (
                  <GroupMenu key={entry.label} group={entry} active={active} />
                ) : (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    aria-current={entry.href === active ? "page" : undefined}
                    className={`${linkBase} ${
                      entry.href === active
                        ? "bg-brand-soft text-brand"
                        : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    }`}
                  >
                    {entry.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="hidden h-10 items-center gap-2 rounded-mw-md px-3 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink lg:inline-flex"
            >
              <LogOut size={16} aria-hidden /> Log out
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-sunken lg:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] flex-col gap-6 overflow-y-auto bg-surface p-6 shadow-mw-float"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif-mw text-[22px] text-ocean">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-sunken"
              >
                <X size={22} />
              </button>
            </div>
            <nav aria-label="Main" className="flex flex-col gap-5">
              {NAV.map((entry) => {
                const items = isGroup(entry) ? entry.items : [entry];
                return (
                  <div key={isGroup(entry) ? entry.label : entry.href} className="flex flex-col gap-1">
                    {isGroup(entry) && <p className="px-3 text-xs font-semibold text-ink-muted">{entry.label}</p>}
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={item.href === active ? "page" : undefined}
                        className={`flex h-11 items-center rounded-mw-md px-3 text-[15px] font-medium ${
                          item.href === active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface-sunken"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={logout}
              className="mt-auto flex h-11 items-center gap-2 rounded-mw-md px-3 text-[15px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <LogOut size={18} aria-hidden /> Log out
            </button>
          </aside>
        </div>
      )}

      {/* pb-28 reserves space for the fixed ConsentBanner so it never sits on
          top of content near the bottom of a page, e.g. the resume wizard's
          submit button. */}
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:py-10 sm:pb-28">{children}</main>
    </MeadowScope>
  );
}
