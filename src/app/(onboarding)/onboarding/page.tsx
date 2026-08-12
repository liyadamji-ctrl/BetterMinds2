import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { OnboardingWizard, type Role } from "@/features/onboarding/components/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const profile = await db.profile.findUnique({
    where: { id: session.userId },
    select: { needsOnboarding: true, role: true },
  });

  // If onboarding already done, send to the right dashboard.
  if (!profile?.needsOnboarding) {
    redirect(profile?.role === "ADMIN" ? "/admin" : profile?.role === "COMPANY" ? "/company" : "/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome! Let&rsquo;s set up your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          This helps us personalise your experience. You can always update it later.
        </p>
      </div>
      <OnboardingWizard initialRole={(profile?.role ?? "CUSTOMER") as Role} />
    </main>
  );
}
