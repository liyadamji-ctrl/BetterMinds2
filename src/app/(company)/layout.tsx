import { redirect } from "next/navigation";
import { requireCompany } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { CompanyNav } from "@/components/CompanyNav";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompany();

  // If onboarding wasn't finished yet, send them there first.
  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { needsOnboarding: true },
  });
  if (profile?.needsOnboarding) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-slate-50">
      <CompanyNav />
      <AppErrorBoundary scope="company">
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </AppErrorBoundary>
    </div>
  );
}
