import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-semibold text-indigo-700">Focal</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">
          New here?{" "}
          <Link href="/signup" className="font-medium text-indigo-700 hover:underline">
            Create a free account
          </Link>
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
