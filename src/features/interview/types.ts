export type InterviewType = "BEHAVIORAL" | "TECHNICAL" | "MIXED";

export type CameraMetrics = {
  /** Share of analysed frames (0-100) where a face was visible. */
  facePresentPct: number;
  /** Share of face-visible frames where the person looked at the camera. */
  eyeContactPct: number;
  /** Share of face-visible frames where the head was held steady. */
  headSteadyPct: number;
  /** Number of frames analysed; low counts mean the numbers are unreliable. */
  samples: number;
};

export type AnswerAnalysis = {
  /** 0-100, from Groq: relevance, structure, specificity. */
  contentScore: number;
  /** 0-100, computed locally from pace and filler words. */
  deliveryScore: number;
  /** 0-100, computed locally from camera metrics; null when camera was off. */
  cameraScore: number | null;
  strengths: string[];
  improvements: string[];
  /** One concrete sample of a stronger way to answer. */
  betterAnswerTip: string;
};

export type InterviewQuestion = {
  id: string;
  category: "behavioral" | "technical" | "situational" | "motivation";
  question: string;
  /** What a strong answer should cover; shown only after answering. */
  lookFor: string;
  transcript: string | null;
  durationSec: number | null;
  wordsPerMinute: number | null;
  fillerCount: number | null;
  camera: CameraMetrics | null;
  analysis: AnswerAnalysis | null;
  /** How confident the person said they felt, 1-5; null/absent when skipped. */
  selfConfidence?: number | null;
};

export type InterviewReport = {
  overallScore: number;
  contentScore: number;
  deliveryScore: number;
  cameraScore: number | null;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  /** True when at least one answer had usable camera data. */
  cameraUsed: boolean;
};
