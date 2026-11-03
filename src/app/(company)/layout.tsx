import { redirect } from "next/navigation";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppShell, type NavEntry } from "@/components/teamstead/AppShell";
import { FeatureViewTracker } from "@/features/analytics/components/FeatureViewTracker";

const NAV: NavEntry[] = [
  { href: "/company", label: "Overview", icon: "grid", exact: true },
  { href: "/company/jobs", label: "Job postings", icon: "briefcase" },
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompany();

  // If onboarding wasn't finished yet, send them there first.
  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { needsOnboarding: true },
  });
  if (profile?.needsOnboarding) redirect("/onboarding");

  return (
    <AppShell nav={NAV} homeHref="/company">
      <FeatureViewTracker />
      <AppErrorBoundary scope="company">{children}</AppErrorBoundary>
    </AppShell>
  );
}
