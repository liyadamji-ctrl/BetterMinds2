import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ConsentBanner } from "@/features/session-recording/components/ConsentBanner";
import { RecorderProvider } from "@/features/session-recording/components/RecorderProvider";
import { CustomerNav } from "@/components/CustomerNav";

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
    <div className="min-h-screen bg-slate-50">
      <CustomerNav />
      <AppErrorBoundary scope="customer">
        {/* pb-28 reserves space for the fixed ConsentBanner below so it can
            never sit on top of — and silently swallow clicks on — content
            near the bottom of a page, e.g. the resume wizard's submit button. */}
        <main className="mx-auto max-w-4xl px-6 py-10 pb-28">{children}</main>
      </AppErrorBoundary>
      <AppErrorBoundary scope="session-recording">
        <RecorderProvider />
        <ConsentBanner />
      </AppErrorBoundary>
    </div>
  );
}
