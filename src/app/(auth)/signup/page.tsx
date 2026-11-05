import Link from "next/link";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { AuthFrame } from "@/components/meadow/AuthFrame";

export default function SignupPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean">
            Create Your Account
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
        <SignupForm />
      </div>
    </AuthFrame>
  );
}
