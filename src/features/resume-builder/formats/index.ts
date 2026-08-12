import type { ResumeFormat } from "./types";
import { classicFormat } from "./classic";
import { modernFormat } from "./modern";

/**
 * Every available resume format, in one place. To add a new one:
 *   1. Copy classic.ts (or modern.ts) to `<id>.ts`.
 *   2. Change `id`, `name`, `description`, and the `render()` styling.
 *   3. Register it below.
 * The wizard, editor, and export buttons are all generic — they read
 * whatever is in this list and need no changes for a new format.
 */
export const resumeFormats: ResumeFormat[] = [classicFormat, modernFormat];

export function getResumeFormat(id: string): ResumeFormat | undefined {
  return resumeFormats.find((f) => f.id === id);
}

export * from "./types";
