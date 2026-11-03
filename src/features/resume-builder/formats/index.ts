import type { ResumeFormat } from "./types";
import { classicFormat } from "./classic";
import { modernFormat } from "./modern";
import { compactFormat } from "./compact";
import { minimalFormat } from "./minimal";
import { executiveFormat } from "./executive";

/**
 * Every available resume format, in one place. To add a new one:
 *   1. Copy minimal.ts to `<id>.ts` (it reuses the shared wizard schema).
 *   2. Change `id`, `name`, `description`, and the `render()` styling.
 *   3. Register it below.
 * The wizard, editor, export buttons and CV-to-resume flow are all generic —
 * they read whatever is in this list and need no changes for a new format.
 */
export const resumeFormats: ResumeFormat[] = [
  classicFormat,
  modernFormat,
  compactFormat,
  minimalFormat,
  executiveFormat,
];

export function getResumeFormat(id: string): ResumeFormat | undefined {
  return resumeFormats.find((f) => f.id === id);
}

export * from "./types";
