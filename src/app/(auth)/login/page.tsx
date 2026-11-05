import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthFrame } from "@/components/meadow/AuthFrame";

export default function LoginPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean">
            Welcome Back
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-brand underline-offset-4 hover:underline">
              Create a free account
            </Link>
          </p>
        </div>
        <LoginForm />
      </div>
    </AuthFrame>
  );
}
