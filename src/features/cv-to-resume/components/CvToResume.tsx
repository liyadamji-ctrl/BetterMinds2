"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { extractTextFromFile } from "@/features/resume-analyzer/lib/extractText";
import { resumeFormats, type ResumeAnswers } from "@/features/resume-builder/formats";

type Point = { point: string; reason: string };
type Analysis = { keep: Point[]; cut: Point[]; missing: string[]; answers: ResumeAnswers };

export function CvToResume() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [formatId, setFormatId] = useState(resumeFormats[0]?.id ?? "");
  const [title, setTitle] = useState("My resume");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const cvText = await extractTextFromFile(file);
      const res = await fetch("/api/cv-to-resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvText, targetRole: targetRole.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't analyze that CV.");
        return;
      }
      setAnalysis(data);
      const name = (data.answers?.personal as Record<string, string> | undefined)?.fullName;
      if (name) setTitle(`${name} — resume`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function createResume() {
    if (!analysis) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: formatId, title: title.trim() || "My resume", answers: analysis.answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't create your resume.");
        return;
      }
      router.push(`/resume-builder/edit/${data.id}`);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-mw-lg bg-surface-raised shadow-mw-card p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Your CV (PDF, DOCX or TXT)</span>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              {file ? "Change file" : "Upload your CV"}
            </Button>
            <span className="text-sm text-slate-600">{file ? file.name : "No file chosen yet"}</span>
          </div>
          <p className="text-xs text-slate-500">The file is read in your browser; only its text is sent for analysis.</p>
        </div>
        <TextField
          label="Job You're Applying For (optional)"
          name="targetRole"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. junior data analyst"
          maxLength={150}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <Button onClick={analyze} disabled={!file || analyzing}>
            {analyzing ? "Analyzing your CV…" : analysis ? "Analyze again" : "Analyze my CV"}
          </Button>
        </div>
      </section>

      {analysis && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <PointList title="Keep on Your Resume" tone="keep" points={analysis.keep} />
            <PointList title="Leave Off Your Resume" tone="cut" points={analysis.cut} />
          </section>

          {analysis.missing.length > 0 && (
            <section className="rounded-mw-lg border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-slate-900">Worth Adding</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                We only used what is in your CV — add these yourself in the editor if they apply.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Pick a Template</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resumeFormats.map((format) => {
                const selected = format.id === formatId;
                return (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => setFormatId(format.id)}
                    className={`flex flex-col gap-2 rounded-mw-lg border bg-white p-3 text-left transition-shadow hover:shadow-md ${
                      selected ? "border-indigo-700 ring-2 ring-indigo-200" : "border-slate-200"
                    }`}
                  >
                    <div className="pointer-events-none h-56 overflow-hidden rounded border border-slate-100 bg-[#ffffff]">
                      <div
                        style={{ width: 720, transform: "scale(0.38)", transformOrigin: "top left" }}
                        dangerouslySetInnerHTML={{ __html: format.render(analysis.answers) }}
                      />
                    </div>
                    <span className="font-medium text-slate-900">{format.name}</span>
                    <span className="text-xs text-slate-500">{format.description}</span>
                  </button>
                );
              })}
            </div>

            <div className="max-w-md">
              <TextField label="Resume Title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
            </div>
            <div>
              <Button onClick={createResume} disabled={creating}>
                {creating ? "Creating…" : "Create my resume"}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PointList({ title, tone, points }: { title: string; tone: "keep" | "cut"; points: Point[] }) {
  const styles = tone === "keep" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50";
  return (
    <div className={`rounded-mw-lg border p-5 ${styles}`}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {points.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Nothing flagged.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {points.map((p) => (
            <li key={p.point} className="text-sm">
              <span className="font-medium text-slate-900">{p.point}</span>
              {p.reason && <span className="block text-slate-600">{p.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
