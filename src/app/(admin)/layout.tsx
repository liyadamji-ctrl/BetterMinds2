import { requireAdmin } from "@/features/auth/lib/guard";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppShell, type NavEntry } from "@/components/teamstead/AppShell";

const NAV: NavEntry[] = [
  { href: "/admin", label: "Overview", icon: "grid", exact: true },
  { href: "/admin/features", label: "Feature Usage", icon: "chart" },
  { href: "/admin/companies", label: "Companies", icon: "building" },
  { href: "/admin/analyses", label: "Resume Analyses", icon: "analysis" },
  { href: "/admin/sessions", label: "Session Recordings", icon: "recording" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Also enforced in middleware.ts — this is the belt-and-suspenders check
  // that runs even if a page is ever reached a different way.
  await requireAdmin();

  return (
    <AppShell nav={NAV} homeHref="/admin" badge="Admin">
      <AppErrorBoundary scope="admin">{children}</AppErrorBoundary>
    </AppShell>
  );
}
