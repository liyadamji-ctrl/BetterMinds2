"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { extractTextFromFile } from "../lib/extractText";
import type { AnalysisResult, ResumeAnalysisDetail, ResumeAnalysisSummary } from "../lib/analysisSchema";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 75 ? "bg-green-100 text-green-800" : score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  );
}

function ResultPanel({ result, title }: { result: AnalysisResult; title: string }) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Match for &ldquo;{title}&rdquo;</h2>
        <ScoreBadge score={result.matchScore} />
      </div>

      <p className="text-sm text-slate-700">{result.summary}</p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Strengths</h3>
          {result.strengths.length === 0 ? (
            <p className="text-sm text-slate-500">None noted.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {result.strengths.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Gaps</h3>
          {result.gaps.length === 0 ? (
            <p className="text-sm text-slate-500">None noted.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {result.gaps.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Suggestions</h3>
          {result.suggestions.length === 0 ? (
            <p className="text-sm text-slate-500">None noted.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {result.suggestions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Missing keywords</h3>
          {result.missingKeywords.length === 0 ? (
            <p className="text-sm text-slate-500">None noted.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {result.missingKeywords.map((kw, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResumeAnalyzer({ initialHistory }: { initialHistory: ResumeAnalysisSummary[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [history, setHistory] = useState<ResumeAnalysisSummary[]>(initialHistory);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractError(null);
    setExtracting(true);
    setResumeText("");
    setFileName(file.name);

    try {
      const text = await extractTextFromFile(file);
      setResumeText(text);
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : "Couldn't read that file.");
      setFileName(null);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (!resumeText) {
      setSubmitError("Upload a resume first.");
      return;
    }
    if (!jobTitle.trim()) {
      setSubmitError("Enter the job you're analyzing against.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/resume-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: fileName ?? undefined,
          jobTitle: jobTitle.trim(),
          jobDescription: jobDescription.trim() || undefined,
          resumeText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong");
        return;
      }

      setResult(data.result as AnalysisResult);
      setActiveTitle(jobTitle.trim());
      setHistory((prev) => [
        {
          id: data.id,
          fileName: fileName ?? null,
          jobTitle: jobTitle.trim(),
          matchScore: data.result.matchScore,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      setSubmitError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function viewHistoryItem(id: string) {
    setLoadingHistoryId(id);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/resume-analyses/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Couldn't load that analysis");
        return;
      }
      const detail = data.analysis as ResumeAnalysisDetail;
      setResult(detail.result);
      setActiveTitle(detail.jobTitle);
    } finally {
      setLoadingHistoryId(null);
    }
  }

  async function deleteHistoryItem(id: string) {
    const previous = history;
    setHistory((prev) => prev.filter((item) => item.id !== id));
    const res = await fetch(`/api/resume-analyses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setHistory(previous);
      setSubmitError("Couldn't delete that analysis.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">1. Upload your resume</h2>
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileChange}
            className="text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-800"
          />
          <p className="text-xs text-slate-500">PDF, DOCX, or TXT — up to 8MB. Your file is read in your browser and never uploaded as-is.</p>
          {extracting && <p className="text-sm text-slate-600">Reading {fileName}…</p>}
          {extractError && <p className="text-sm text-red-600">{extractError}</p>}
          {!extracting && !extractError && resumeText && (
            <p className="text-sm text-green-700">Loaded {fileName} ({resumeText.length.toLocaleString()} characters).</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">2. Which job is this for?</h2>
        <div className="flex flex-col gap-4">
          <TextField
            label="Job title"
            placeholder="e.g. Senior Backend Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
          />
          <TextAreaField
            label="Job description (optional, but the analysis is much better with it)"
            placeholder="Paste the job posting or key requirements here…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <Button onClick={handleSubmit} disabled={submitting || extracting || !resumeText}>
        {submitting ? "Analyzing…" : "Analyze my resume"}
      </Button>

      {result && activeTitle && <ResultPanel result={result} title={activeTitle} />}

      <div>
        <h2 className="mb-3 font-semibold text-slate-900">Past analyses</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No analyses yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.jobTitle}</p>
                  <p className="text-xs text-slate-500">
                    {item.fileName ?? "resume"} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge score={item.matchScore} />
                  <Button
                    variant="secondary"
                    onClick={() => viewHistoryItem(item.id)}
                    disabled={loadingHistoryId === item.id}
                  >
                    {loadingHistoryId === item.id ? "Loading…" : "View"}
                  </Button>
                  <Button variant="ghost" onClick={() => deleteHistoryItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
