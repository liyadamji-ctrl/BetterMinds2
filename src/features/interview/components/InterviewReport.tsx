import type { InterviewQuestion, InterviewReport as Report } from "../types";
import { scoreLabel } from "../lib/scoring";

function tone(score: number) {
  if (score >= 70) return "text-emerald-700";
  if (score >= 55) return "text-amber-600";
  return "text-rose-600";
}

function ScoreCard({ label, score, hint }: { label: string; score: number | null; hint?: string }) {
  return (
    <div className="rounded-mw-lg bg-surface-raised shadow-mw-card p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      {score === null ? (
        <p className="mt-1 text-sm text-slate-500">Camera was off or not usable</p>
      ) : (
        <>
          <p className={`mt-1 text-3xl font-bold ${tone(score)}`}>{score}</p>
          <p className="text-xs text-slate-500">{hint ?? scoreLabel(score)}</p>
        </>
      )}
    </div>
  );
}

function Bullets({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`rounded-mw-lg border p-5 ${color}`}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function InterviewReport({ report, questions }: { report: Report; questions: InterviewQuestion[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-mw-lg bg-surface-raised shadow-mw-card p-6">
        <p className="text-sm text-slate-500">Overall score</p>
        <p className={`text-5xl font-bold ${tone(report.overallScore)}`}>
          {report.overallScore}
          <span className="text-xl font-medium text-slate-400"> / 100</span>
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">{scoreLabel(report.overallScore)}</p>
        <p className="mt-3 text-sm text-slate-700">{report.summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreCard label="Answer Quality" score={report.contentScore} />
        <ScoreCard label="Delivery (pace, fillers)" score={report.deliveryScore} />
        <ScoreCard label="Camera Presence" score={report.cameraScore} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bullets title="What Went Well" items={report.strengths} color="border-emerald-200 bg-emerald-50" />
        <Bullets title="Key Things to Improve" items={report.improvements} color="border-amber-200 bg-amber-50" />
      </div>
      <Bullets title="Practice Next" items={report.nextSteps} color="border-indigo-200 bg-indigo-50" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Question by Question</h2>
        {questions.map((q, i) => (
          <details key={q.id} className="rounded-mw-lg bg-surface-raised shadow-mw-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-900">
              {i + 1}. {q.question}
              {q.analysis && (
                <span className={`ml-2 text-xs font-semibold ${tone(q.analysis.contentScore)}`}>
                  content {q.analysis.contentScore}
                </span>
              )}
            </summary>
            {q.analysis ? (
              <div className="mt-3 flex flex-col gap-3 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Your answer</p>
                  <p className="whitespace-pre-line">{q.transcript || "(nothing recorded)"}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {q.wordsPerMinute !== null ? `${q.wordsPerMinute} words/min · ` : ""}
                  {q.fillerCount ?? 0} filler words
                  {q.camera ? ` · eye contact ${q.camera.eyeContactPct}% · head steady ${q.camera.headSteadyPct}%` : ""}
                </p>
                {q.analysis.improvements.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">
                    {q.analysis.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {q.analysis.betterAnswerTip && (
                  <p className="rounded bg-slate-50 p-2">
                    <span className="font-medium">Tip: </span>
                    {q.analysis.betterAnswerTip}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Not answered.</p>
            )}
          </details>
        ))}
      </section>

      <p className="text-xs text-slate-500">
        Scores are a practice guide: answer quality is judged by AI, delivery is computed from pace and filler words,
        and camera presence is an on-device estimate of eye contact and head steadiness. No audio or video is saved.
      </p>
    </div>
  );
}
