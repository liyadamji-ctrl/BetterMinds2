import { requireUser } from "@/features/auth/lib/guard";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
