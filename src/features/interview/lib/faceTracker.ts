import type { CameraMetrics } from "../types";

/**
 * On-device face analysis for the interview simulator. Runs MediaPipe's Face
 * Landmarker in the browser: video frames are never uploaded or stored, and
 * only the summary percentages in CameraMetrics leave this module.
 *
 * The numbers are rough estimates from face landmarks (head direction, iris
 * position, head movement), not a precise read of how someone presents.
 * Client-only: it touches the DOM and dynamically imports the model runtime.
 */

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SAMPLE_EVERY_MS = 250;

type Point = { x: number; y: number };

// FaceMesh landmark indexes.
const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

type Counters = { frames: number; face: number; eye: number; steady: number };
const emptyCounters = (): Counters => ({ frames: 0, face: 0, eye: 0, steady: 0 });

export type FaceTracker = {
  /** Begin counting frames for a new answer. */
  start: () => void;
  /** Stop counting and return the answer's metrics (null if nothing sampled). */
  stop: () => CameraMetrics | null;
  /** Release the model and timers. */
  dispose: () => void;
};

export async function createFaceTracker(video: HTMLVideoElement): Promise<FaceTracker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  let counters: Counters | null = null;
  let previousNose: Point | null = null;
  let lastVideoTime = -1;

  const timer = window.setInterval(() => {
    if (!counters || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const result = landmarker.detectForVideo(video, performance.now());
    counters.frames += 1;

    const lm = result.faceLandmarks[0];
    if (!lm) {
      previousNose = null;
      return;
    }
    counters.face += 1;

    const faceWidth = Math.abs(lm[RIGHT_CHEEK].x - lm[LEFT_CHEEK].x) || 1e-6;
    const faceHeight = Math.abs(lm[CHIN].y - lm[FOREHEAD].y) || 1e-6;

    // Head direction: where the nose sits between the cheeks and forehead/chin.
    const yawRatio = (lm[NOSE_TIP].x - lm[LEFT_CHEEK].x) / (lm[RIGHT_CHEEK].x - lm[LEFT_CHEEK].x);
    const pitchRatio = (lm[NOSE_TIP].y - lm[FOREHEAD].y) / (lm[CHIN].y - lm[FOREHEAD].y);
    const facingCamera = Math.abs(yawRatio - 0.5) < 0.13 && pitchRatio > 0.45 && pitchRatio < 0.78;

    // Gaze: iris centred between the eye corners on both eyes.
    let irisCentred = true;
    if (lm.length > RIGHT_IRIS) {
      const left = (lm[LEFT_IRIS].x - lm[LEFT_EYE_OUTER].x) / (lm[LEFT_EYE_INNER].x - lm[LEFT_EYE_OUTER].x);
      const right = (lm[RIGHT_IRIS].x - lm[RIGHT_EYE_INNER].x) / (lm[RIGHT_EYE_OUTER].x - lm[RIGHT_EYE_INNER].x);
      irisCentred = left > 0.33 && left < 0.67 && right > 0.33 && right < 0.67;
    }
    if (facingCamera && irisCentred) counters.eye += 1;

    // Steadiness: how far the nose moved since the last sample, relative to face size.
    const nose = { x: lm[NOSE_TIP].x, y: lm[NOSE_TIP].y };
    if (previousNose) {
      const moved = Math.hypot(nose.x - previousNose.x, (nose.y - previousNose.y) * (faceWidth / faceHeight)) / faceWidth;
      if (moved < 0.06) counters.steady += 1;
    } else {
      counters.steady += 1;
    }
    previousNose = nose;
  }, SAMPLE_EVERY_MS);

  return {
    start() {
      counters = emptyCounters();
      previousNose = null;
    },
    stop() {
      const c = counters;
      counters = null;
      if (!c || c.frames === 0) return null;
      const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
      return {
        samples: c.frames,
        facePresentPct: pct(c.face, c.frames),
        eyeContactPct: pct(c.eye, c.face),
        headSteadyPct: pct(c.steady, c.face),
      };
    },
    dispose() {
      window.clearInterval(timer);
      landmarker.close();
    },
  };
}
