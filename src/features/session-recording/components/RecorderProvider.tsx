"use client";

import { useEffect, useRef } from "react";
import { record, type eventWithTime } from "rrweb";
import { sendBatch } from "../lib/sendBeaconBatch";
import { CONSENT_EVENT } from "./ConsentBanner";

const FLUSH_INTERVAL_MS = 10_000;

/**
 * Mounted once near the root of the customer layout. Renders nothing —
 * it just starts (or stops) rrweb capture based on consent, and batches
 * events to the server every 10 seconds. Crashes here are caught by the
 * AppErrorBoundary so they can never take the rest of the page down.
 */
export function RecorderProvider() {
  const bufferRef = useRef<eventWithTime[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();

    function start() {
      if (stopRef.current) return;
      const stop = record({
        emit(event) {
          bufferRef.current.push(event);
        },
      });
      stopRef.current = stop ?? null;
    }

    function stop() {
      stopRef.current?.();
      stopRef.current = null;
    }

    function flush(useBeacon = false) {
      if (!bufferRef.current.length) return;
      const events = bufferRef.current;
      bufferRef.current = [];
      sendBatch(sessionIdRef.current, events, useBeacon);
    }

    if (localStorage.getItem("sessionRecordingConsent") === "true") start();

    function onConsentChange(event: Event) {
      const allowed = (event as CustomEvent<{ allowed: boolean }>).detail?.allowed;
      if (allowed) start();
      else stop();
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange);

    const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const onUnload = () => flush(true);
    window.addEventListener("pagehide", onUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener(CONSENT_EVENT, onConsentChange);
      window.removeEventListener("pagehide", onUnload);
      flush(true);
      stop();
    };
  }, []);

  return null;
}
