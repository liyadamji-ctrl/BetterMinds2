"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  /** When provided, stores the chosen account type in a short-lived cookie so
   *  the OAuth callback can apply it before redirecting to onboarding. */
  accountType?: "seeker" | "employer";
}

export function GoogleButton({ accountType }: Props) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);

    // Store the account type choice so the server-side callback can apply it
    // even after the Google redirect (where client state is lost).
    if (accountType) {
      document.cookie = `signup_account_type=${accountType}; path=/; max-age=300; SameSite=Lax`;
    }

    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // Browser navigates away to Google here; nothing left to do on success.
    setLoading(false);
  }

  return (
    <Button type="button" variant="secondary" onClick={signInWithGoogle} disabled={loading}>
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
