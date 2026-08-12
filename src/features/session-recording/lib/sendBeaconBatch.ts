import type { eventWithTime } from "rrweb";

/** POSTs a batch; falls back to sendBeacon on page unload when fetch can't run. */
export function sendBatch(sessionId: string, events: eventWithTime[], useBeacon = false) {
  if (!events.length) return;
  const payload = JSON.stringify({ sessionId, events });

  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/session-recording", blob);
    return;
  }

  fetch("/api/session-recording", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // A dropped batch just means a small gap in the replay — never worth
    // surfacing to the user or retrying indefinitely.
  });
}
