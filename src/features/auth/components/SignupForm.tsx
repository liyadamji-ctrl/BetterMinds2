"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleButton } from "./GoogleButton";

type AccountType = "seeker" | "employer";

function TypeCard({
  type,
  selected,
  onClick,
}: {
  type: AccountType;
  selected: boolean;
  onClick: () => void;
}) {
  const isSeeker = type === "seeker";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-colors ${
        selected
          ? "border-indigo-600 bg-indigo-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className="text-2xl">{isSeeker ? "🎓" : "🏢"}</span>
      <span className="font-semibold text-slate-900">{isSeeker ? "Job Seeker" : "Employer"}</span>
      <span className="text-xs text-slate-500">
        {isSeeker
          ? "Build your resume, find internships, and prep for interviews"
          : "Post jobs, find candidates, and screen resumes with AI"}
      </span>
    </button>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("seeker");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            name,
            account_type: accountType,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/onboarding");
        router.refresh();
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email)}&type=${accountType}`);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-700">I am a…</p>
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            type="seeker"
            selected={accountType === "seeker"}
            onClick={() => setAccountType("seeker")}
          />
          <TypeCard
            type="employer"
            selected={accountType === "employer"}
            onClick={() => setAccountType("employer")}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label={accountType === "employer" ? "Company name" : "Full name"}
          name="name"
          autoComplete="name"
          required
        />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex flex-col gap-1">
        <GoogleButton accountType={accountType} />
        <p className="text-center text-xs text-slate-400">
          Signing up as {accountType === "employer" ? "an Employer" : "a Job Seeker"}
        </p>
      </div>
    </div>
  );
}
