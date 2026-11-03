"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Same feature opened again within this window counts as one visit.
const DEDUPE_MS = 30 * 60 * 1000;

/**
 * Reports "the user opened this page" so the admin can see which features get
 * visited. Renders nothing; failures are silent so it can never get in the
 * user's way. The server decides which paths count (see features.ts).
 */
export function FeatureViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Visits are keyed by the top-level section so flicking between
    // /cover-letters and /cover-letters/new doesn't count twice.
    const key = `viewed:${pathname.split("/").slice(0, 3).join("/")}`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < DEDUPE_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // sessionStorage can be unavailable (private mode) — just send it.
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
