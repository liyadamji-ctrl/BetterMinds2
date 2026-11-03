import type { CameraMetrics, InterviewQuestion } from "../types";

/**
 * Pure scoring helpers, used on the server (final report) and the client
 * (live speech stats). No AI here: these are simple, explainable numbers.
 */

const FILLER_PATTERNS = [
  /\bum+\b/g,
  /\buh+\b/g,
  /\ber+m*\b/g,
  /\blike\b/g,
  /\byou know\b/g,
  /\bbasically\b/g,
  /\bactually\b/g,
  /\bliterally\b/g,
  /\bsort of\b/g,
  /\bkind of\b/g,
  /\bi mean\b/g,
];

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countFillers(text: string): number {
  const lower = text.toLowerCase();
  return FILLER_PATTERNS.reduce((sum, re) => sum + (lower.match(re)?.length ?? 0), 0);
}

export function wordsPerMinute(text: string, durationSec: number): number | null {
  if (durationSec < 5) return null;
  return Math.round((countWords(text) / durationSec) * 60);
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * 0-100 from speaking pace and filler density. Ideal pace is roughly
 * 110-160 words per minute; filler words cost points above ~3 per 100 words.
 * Very short answers are penalised because there is little to judge.
 */
export function deliveryScore(transcript: string, durationSec: number): number {
  const words = countWords(transcript);
  if (words === 0) return 0;

  let score = 100;

  const wpm = wordsPerMinute(transcript, durationSec);
  if (wpm !== null) {
    if (wpm < 110) score -= Math.min(30, (110 - wpm) * 0.6);
    else if (wpm > 160) score -= Math.min(30, (wpm - 160) * 0.6);
  }

  const fillerPer100 = (countFillers(transcript) / words) * 100;
  if (fillerPer100 > 3) score -= Math.min(35, (fillerPer100 - 3) * 5);

  if (words < 30) score -= Math.min(30, (30 - words) * 1.2);

  return clamp(score);
}

/** 0-100 from camera metrics; null when there is too little data to judge. */
export function cameraScore(camera: CameraMetrics | null): number | null {
  if (!camera || camera.samples < 10) return null;
  const score =
    camera.eyeContactPct * 0.5 + camera.headSteadyPct * 0.25 + camera.facePresentPct * 0.25;
  return clamp(score);
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Overall = content 60% / delivery 20% / camera 20%. When the camera was off
 * or unusable, its weight moves to content and delivery (75% / 25%).
 */
export function overallScores(questions: InterviewQuestion[]) {
  const answered = questions.filter((q) => q.analysis);
  const content = average(answered.map((q) => q.analysis!.contentScore));
  const delivery = average(answered.map((q) => q.analysis!.deliveryScore));
  const camera = average(answered.map((q) => q.analysis!.cameraScore));

  if (content === null || delivery === null) {
    return { overall: 0, content: 0, delivery: 0, camera: null as number | null };
  }

  const overall =
    camera === null ? content * 0.75 + delivery * 0.25 : content * 0.6 + delivery * 0.2 + camera * 0.2;

  return {
    overall: clamp(overall),
    content: clamp(content),
    delivery: clamp(delivery),
    camera: camera === null ? null : clamp(camera),
  };
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Developing";
  return "Needs work";
}
