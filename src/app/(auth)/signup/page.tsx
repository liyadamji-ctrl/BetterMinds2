import Link from "next/link";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { Logo } from "@/components/Logo";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <Logo />
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-indigo-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
