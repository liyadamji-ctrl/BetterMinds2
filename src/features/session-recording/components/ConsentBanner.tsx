"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const CONSENT_EVENT = "focal:session-recording-consent";

/**
 * Shown once per account until answered. The choice is persisted server-side
 * (Consent table) so it survives across devices, and mirrored to
 * localStorage so we don't re-fetch it on every page load.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const known = localStorage.getItem("sessionRecordingConsent");
    if (known === null) setVisible(true);
  }, []);

  async function respond(allowed: boolean) {
    setSaving(true);
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed }),
      });
      localStorage.setItem("sessionRecordingConsent", String(allowed));
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { allowed } }));
    } finally {
      setSaving(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          We&rsquo;d like to record how you use Focal (clicks and page views — never
          passwords or personal data) so we can improve the experience. You can change
          this anytime in your account settings.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => respond(false)}>
            No thanks
          </Button>
          <Button disabled={saving} onClick={() => respond(true)}>
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}
