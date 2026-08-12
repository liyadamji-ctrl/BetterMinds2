"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleButton } from "./GoogleButton";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Ask the server which area this account belongs in.
      const res = await fetch("/api/me");
      const data = await res.json();

      if (data.needsOnboarding) {
        router.push("/onboarding");
      } else if (data.role === "ADMIN") {
        router.push("/admin");
      } else if (data.role === "COMPANY") {
        router.push("/company");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleButton />
    </div>
  );
}
