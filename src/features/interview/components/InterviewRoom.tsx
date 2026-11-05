"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createFaceTracker, type FaceTracker } from "../lib/faceTracker";
import { useSpeech } from "../lib/useSpeech";
import { InterviewReport } from "./InterviewReport";
import type { CameraMetrics, InterviewQuestion, InterviewReport as Report } from "../types";

type Phase = "idle" | "recording" | "stopping" | "edit" | "analyzing" | "feedback";

export function InterviewRoom({
  sessionId,
  jobTitle,
  initialQuestions,
  initialReport,
}: {
  sessionId: string;
  jobTitle: string;
  initialQuestions: InterviewQuestion[];
  initialReport: Report | null;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [report, setReport] = useState(initialReport);
  const firstOpen = initialQuestions.findIndex((q) => !q.analysis);
  const [index, setIndex] = useState(firstOpen === -1 ? initialQuestions.length - 1 : firstOpen);
  const [phase, setPhase] = useState<Phase>(firstOpen === -1 ? "feedback" : "idle");

  const speech = useSpeech();
  const [typedMode, setTypedMode] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const startedAt = useRef(0);
  const pending = useRef<{ durationSec: number; camera: CameraMetrics | null }>({ durationSec: 0, camera: null });
  const [seconds, setSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "loading" | "on">("off");
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const question = questions[index];
  const answeredCount = questions.filter((q) => q.analysis).length;
  const allAnswered = answeredCount === questions.length;
  const voiceAvailable = speech.supported && !typedMode;

  // Recording timer.
  useEffect(() => {
    if (phase !== "recording") return;
    const t = window.setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [phase]);

  const stopCamera = useCallback(() => {
    trackerRef.current?.dispose();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraState("off");
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function toggleCamera() {
    if (cameraState !== "off") {
      stopCamera();
      setCameraNote(null);
      return;
    }
    setCameraState("loading");
    setCameraNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no video element");
      video.srcObject = stream;
      await video.play();
      trackerRef.current = await createFaceTracker(video);
      setCameraState("on");
    } catch {
      stopCamera();
      setCameraNote("Couldn't start the camera or face analysis. You can continue without it; scores will use your answers only.");
    }
  }

  function startRecording() {
    setError(null);
    speech.reset();
    setAnswerText("");
    setSeconds(0);
    startedAt.current = Date.now();
    trackerRef.current?.start();
    speech.start();
    setPhase("recording");
  }

  async function stopRecording() {
    pending.current = {
      durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      camera: trackerRef.current?.stop() ?? null,
    };
    setPhase("stopping");
    // Wait for the browser to hand over its last words before showing the text.
    await speech.stopAndWait();
    setAnswerText(speech.getText());
    setPhase("edit");
  }

  function startTyping() {
    setError(null);
    setAnswerText("");
    pending.current = { durationSec: 0, camera: null };
    setPhase("edit");
  }

  async function submitAnswer() {
    setPhase("analyzing");
    setError(null);
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          transcript: answerText.trim(),
          durationSec: pending.current.durationSec,
          camera: pending.current.camera,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't analyze that answer.");
        setPhase("edit");
        return;
      }
      setQuestions((prev) => prev.map((q) => (q.id === data.question.id ? data.question : q)));
      setPhase("feedback");
    } catch {
      setError("Couldn't reach the server. Your answer is still here, so try again.");
      setPhase("edit");
    }
  }

  function nextQuestion() {
    setIndex((i) => Math.min(i + 1, questions.length - 1));
    setAnswerText("");
    speech.reset();
    setPhase("idle");
  }

  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}/finish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't build your report.");
        return;
      }
      stopCamera();
      setReport(data.report);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  if (report) {
    return (
      <div className="flex flex-col gap-6">
        <InterviewReport report={report} questions={questions} />
        <div className="flex gap-3">
          <Link href="/interview/new">
            <Button>Practice again</Button>
          </Link>
          <Link href="/interview">
            <Button variant="secondary">All sessions</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            {jobTitle} · Question {index + 1} of {questions.length} · {answeredCount} answered
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-indigo-700" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="rounded-mw-lg bg-surface-raised shadow-mw-card p-6">
          <p className="text-xs font-medium uppercase text-indigo-700">{question.category}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{question.question}</h2>
        </div>

        {phase === "idle" && (
          <div className="flex flex-col gap-3 rounded-mw-lg bg-surface-raised shadow-mw-card p-5">
            {voiceAvailable ? (
              <>
                <p className="text-sm text-slate-600">
                  Press record and answer out loud as if in a real interview. Aim for one to two minutes.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={startRecording}>Start answering</Button>
                  <Button variant="ghost" onClick={() => setTypedMode(true)}>
                    Type instead
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  {speech.supported
                    ? "Typing mode. Write your answer as you would say it."
                    : "Voice answers need Chrome or Edge, so you can type your answer here."}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={startTyping}>Write my answer</Button>
                  {speech.supported && (
                    <Button variant="ghost" onClick={() => setTypedMode(false)}>
                      Use voice
                    </Button>
                  )}
                </div>
              </>
            )}
            {speech.error && <p className="text-sm text-red-600">{speech.error}</p>}
          </div>
        )}

        {(phase === "recording" || phase === "stopping") && (
          <div className="flex flex-col gap-3 rounded-mw-lg border border-rose-200 bg-rose-50 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
              {phase === "recording" ? `Recording… ${seconds}s` : "Finishing…"}
            </p>
            <p className="min-h-12 whitespace-pre-line text-sm text-slate-700">
              {speech.finalText || speech.interim ? (
                <>
                  {speech.finalText}
                  {speech.interim && <span className="italic text-slate-400"> {speech.interim}</span>}
                </>
              ) : (
                "Listening… start speaking."
              )}
            </p>
            {speech.error && <p className="text-sm text-red-600">{speech.error}</p>}
            <div>
              <Button onClick={stopRecording} disabled={phase === "stopping"}>
                Stop and review
              </Button>
            </div>
          </div>
        )}

        {(phase === "edit" || phase === "analyzing") && (
          <div className="flex flex-col gap-3 rounded-mw-lg bg-surface-raised shadow-mw-card p-5">
            <label htmlFor="answer" className="text-sm font-medium text-slate-700">
              Your answer {pending.current.durationSec > 0 && <span className="font-normal text-slate-500">(transcribed, fix any mistakes)</span>}
            </label>
            <textarea
              id="answer"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={phase === "analyzing"}
              maxLength={8000}
              className="min-h-40 rounded-mw-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              placeholder="Type your answer here"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <Button onClick={submitAnswer} disabled={phase === "analyzing" || answerText.trim().length < 5}>
                {phase === "analyzing" ? "Analyzing your answer…" : "Submit answer"}
              </Button>
              {phase === "edit" && (
                <Button variant="ghost" onClick={() => setPhase("idle")}>
                  Redo
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "feedback" && question.analysis && (
          <div className="flex flex-col gap-4 rounded-mw-lg bg-surface-raised shadow-mw-card p-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <Stat label="Content" value={question.analysis.contentScore} />
              <Stat label="Delivery" value={question.analysis.deliveryScore} />
              {question.analysis.cameraScore !== null && <Stat label="Camera" value={question.analysis.cameraScore} />}
            </div>
            <p className="text-xs text-slate-500">
              {question.wordsPerMinute !== null ? `${question.wordsPerMinute} words/min · ` : ""}
              {question.fillerCount ?? 0} filler words
              {question.camera ? ` · eye contact ${question.camera.eyeContactPct}%` : ""}
            </p>
            <FeedbackList title="What Worked" items={question.analysis.strengths} />
            <FeedbackList title="To Improve" items={question.analysis.improvements} />
            {question.analysis.betterAnswerTip && (
              <p className="rounded bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-medium">Tip: </span>
                {question.analysis.betterAnswerTip}
              </p>
            )}
            {question.lookFor && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">A strong answer covers: </span>
                {question.lookFor}
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              {index < questions.length - 1 && !allAnswered ? (
                <Button onClick={nextQuestion}>Next question</Button>
              ) : allAnswered ? (
                <Button onClick={finish} disabled={finishing}>
                  {finishing ? "Building your report…" : "Finish and see my report"}
                </Button>
              ) : (
                <Button onClick={nextQuestion}>Next question</Button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-mw-lg border border-slate-200 bg-slate-900">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-[4/3] w-full -scale-x-100 object-cover ${cameraState === "off" ? "hidden" : ""}`}
          />
          {cameraState === "off" && (
            <div className="flex aspect-[4/3] items-center justify-center p-4 text-center text-xs text-slate-300">
              Camera off
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={toggleCamera} disabled={cameraState === "loading" || phase === "recording"}>
          {cameraState === "loading" ? "Starting camera…" : cameraState === "on" ? "Turn camera off" : "Turn camera on"}
        </Button>
        <p className="text-xs text-slate-500">
          Optional. Video is analyzed in your browser to estimate eye contact and head steadiness; it is never uploaded or saved.
        </p>
        {cameraNote && <p className="text-xs text-amber-700">{cameraNote}</p>}
        {answeredCount > 0 && !allAnswered && phase !== "analyzing" && (
          <Button variant="ghost" onClick={finish} disabled={finishing}>
            {finishing ? "Building report…" : "End early and see report"}
          </Button>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <p className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">{value}</p>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
