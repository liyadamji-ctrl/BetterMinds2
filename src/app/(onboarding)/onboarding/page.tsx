import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { OnboardingWizard, type Role } from "@/features/onboarding/components/OnboardingWizard";
import { AuthFrame } from "@/components/meadow/AuthFrame";

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
    <AuthFrame wide>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean">
            Welcome. Let&rsquo;s set up your profile
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            This helps us personalise your experience. You can update it later.
          </p>
        </div>
        <OnboardingWizard initialRole={(profile?.role ?? "CUSTOMER") as Role} />
      </div>
    </AuthFrame>
  );
}
