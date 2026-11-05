"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { GoogleButton } from "./GoogleButton";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    let navigating = false;

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

      // Ask the server which area this account belongs in. If it can't see
      // the new session yet, say so instead of guessing: the old code fell
      // through to /dashboard, which bounced back to /login and made people
      // click Log In twice.
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setError("We couldn't finish logging you in. Please try again.");
        return;
      }
      const data = await res.json();

      const destination = data.needsOnboarding
        ? "/onboarding"
        : data.role === "ADMIN"
          ? "/admin"
          : data.role === "COMPANY"
            ? "/company"
            : "/dashboard";

      // A full page load (not router.push + router.refresh) so the next page is
      // always rendered with the fresh session cookie, never a cached redirect.
      navigating = true;
      window.location.assign(destination);
      return;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      // Stay in the loading state while the browser navigates away.
      if (!navigating) setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Logging In…" : "Log In"}
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
