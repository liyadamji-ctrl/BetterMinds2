"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const CONSENT_EVENT = "focal:session-recording-consent";

/** Per-account key, so a second person on the same browser still gets asked. */
export const consentKey = (userId: string) => `sessionRecordingConsent:${userId}`;

/**
 * Shown once per account until answered. The choice is persisted server-side
 * (Consent table) so it survives across devices, and mirrored to
 * localStorage so we don't re-fetch it on every page load.
 */
export function ConsentBanner({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let known: string | null = null;
    try {
      known = localStorage.getItem(consentKey(userId));
    } catch {}
    if (known !== null) return;

    // Nothing saved in this browser. Ask the server before showing the
    // banner, so someone who already answered on another device isn't asked
    // again. If the check fails, show the banner anyway.
    fetch("/api/consent")
      .then((r) => (r.ok ? r.json() : { allowed: null }))
      .catch(() => ({ allowed: null }))
      .then((data: { allowed: boolean | null }) => {
        if (cancelled) return;
        if (data.allowed === null) {
          setVisible(true);
          return;
        }
        try {
          localStorage.setItem(consentKey(userId), String(data.allowed));
        } catch {}
        window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { allowed: data.allowed } }));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function respond(allowed: boolean) {
    setSaving(true);
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed }),
      });
      try {
        localStorage.setItem(consentKey(userId), String(allowed));
      } catch {}
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
        <div className="flex flex-col gap-1 text-sm text-slate-700">
          <p>
            We&rsquo;d like to record how you use Prepped (clicks and page views, never
            passwords or personal data) so we can improve it. This happens inside Prepped
            only, so your browser won&rsquo;t ask to share your screen.
          </p>
          <p className="text-xs text-slate-500">
            Prefer not to? Choose &ldquo;No thanks&rdquo; and, if you like, record your
            screen or send a voice memo with your feedback instead.
          </p>
        </div>
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
