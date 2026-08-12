"use client";

import { useEffect, useRef } from "react";
import type { eventWithTime } from "rrweb";
import "rrweb-player/dist/style.css";

export function SessionPlayer({ events }: { events: eventWithTime[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || events.length < 2) return;

    let destroyed = false;
    // rrweb-player ships ESM-only and touches `document` at import time,
    // so it's loaded dynamically here rather than at the top of the file.
    import("rrweb-player").then(({ default: Player }) => {
      if (destroyed || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      new Player({
        target: containerRef.current,
        props: { events, width: 900, height: 500, autoPlay: false },
      });
    });

    return () => {
      destroyed = true;
    };
  }, [events]);

  if (events.length < 2) {
    return <p className="text-sm text-slate-500">Not enough captured events to replay yet.</p>;
  }

  return <div ref={containerRef} />;
}
