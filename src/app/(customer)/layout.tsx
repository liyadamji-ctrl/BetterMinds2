import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ConsentBanner } from "@/features/session-recording/components/ConsentBanner";
import { RecorderProvider } from "@/features/session-recording/components/RecorderProvider";
import { CustomerShell } from "@/components/meadow/CustomerShell";
import { FeatureViewTracker } from "@/features/analytics/components/FeatureViewTracker";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { needsOnboarding: true, role: true },
  });

  // Finish onboarding before accessing any customer page.
  if (profile?.needsOnboarding) redirect("/onboarding");

  // Company accounts that somehow ended up here get sent to their own area.
  if (profile?.role === "COMPANY") redirect("/company");

  return (
    <CustomerShell>
      <FeatureViewTracker />
      <AppErrorBoundary scope="customer">{children}</AppErrorBoundary>
      <AppErrorBoundary scope="session-recording">
        <RecorderProvider />
        <ConsentBanner />
      </AppErrorBoundary>
    </CustomerShell>
  );
}
