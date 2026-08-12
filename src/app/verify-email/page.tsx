"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

function VerifyEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function resend() {
    if (!email) return;
    setResending(true);
    setResendError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        setResendError(error.message);
      } else {
        setResent(true);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-5xl">📬</div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Check your inbox</h1>
        <p className="text-sm text-slate-600">
          We sent a verification link to{" "}
          {email ? <strong className="text-slate-800">{email}</strong> : "your email address"}.
          Click it to activate your account and finish setting up your profile.
        </p>
      </div>

      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Didn&rsquo;t get it?</p>
        <p className="mt-1">Check your spam folder, or resend the link below.</p>
      </div>

      {resent ? (
        <p className="text-sm font-medium text-emerald-600">Link resent — check your inbox again.</p>
      ) : (
        <Button
          variant="secondary"
          onClick={resend}
          disabled={resending || !email}
          className="w-full"
        >
          {resending ? "Resending…" : "Resend verification email"}
        </Button>
      )}

      {resendError && <p className="text-sm text-red-600">{resendError}</p>}

      <Link href="/login" className="text-sm text-indigo-700 hover:underline">
        Back to log in
      </Link>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
