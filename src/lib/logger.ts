import fs from "node:fs";
import path from "node:path";

/**
 * Server-only structured logger. Do not import this from client components
 * or from `middleware.ts` (Edge runtime has no filesystem access).
 *
 * Every entry is tagged with a `scope` — the feature or route it came from
 * (e.g. "resume-builder", "admin:sessions", "auth"). That tag is what lets
 * you trace an error back to a single feature without it ever needing to
 * take down anything else. Grep `logs/app.log` for a scope to see its
 * history in isolation.
 */

type Level = "info" | "warn" | "error";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function write(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };

  const line = JSON.stringify(entry);

  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](`[${scope}]`, message, meta ?? "");

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // If the filesystem write fails (e.g. read-only deploy target), the
    // console line above is still there — logging must never throw and
    // take down the feature that called it.
  }
}

export const logger = {
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    write("error", scope, message, meta),
};
