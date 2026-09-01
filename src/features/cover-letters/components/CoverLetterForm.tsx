"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type ApplicationOption = { jobId: string; jobTitle: string; companyName: string };
type PrefillJob = { jobId: string; jobTitle: string; companyName: string };

export function CoverLetterForm({
  resumes,
  applications,
  prefillJob,
  invalidJobId,
}: {
  resumes: { id: string; title: string }[];
  applications: ApplicationOption[];
  prefillJob: PrefillJob | null;
  invalidJobId: boolean;
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [mode, setMode] = useState<"application" | "external">(
    prefillJob ? "application" : invalidJobId ? "external" : applications.length > 0 ? "application" : "external"
  );
  const [selectedJobId, setSelectedJobId] = useState(prefillJob?.jobId ?? applications[0]?.jobId ?? "");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (resumes.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        You need a resume before generating a cover letter.{" "}
        <Link href="/resume-builder" className="text-indigo-700 hover:underline">
          Build one now
        </Link>
        .
      </div>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload =
        mode === "application"
          ? { resumeId, jobId: selectedJobId, notes: notes.trim() || undefined }
          : {
              resumeId,
              companyName: companyName.trim(),
              jobTitle: jobTitle.trim(),
              jobDescription: jobDescription.trim() || undefined,
              notes: notes.trim() || undefined,
            };

      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/cover-letters/${data.id}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const applicationOptions = [
    ...(prefillJob && !applications.some((a) => a.jobId === prefillJob.jobId)
      ? [{ value: prefillJob.jobId, label: `${prefillJob.jobTitle} at ${prefillJob.companyName}` }]
      : []),
    ...applications.map((a) => ({ value: a.jobId, label: `${a.jobTitle} at ${a.companyName}` })),
  ];

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <SelectField
        label="Resume to base it on"
        value={resumeId}
        onChange={(e) => setResumeId(e.target.value)}
        options={resumes.map((r) => ({ value: r.id, label: r.title }))}
      />

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "application" ? "primary" : "secondary"}
            onClick={() => setMode("application")}
            disabled={applications.length === 0 && !prefillJob}
          >
            One of my applications
          </Button>
          <Button
            type="button"
            variant={mode === "external" ? "primary" : "secondary"}
            onClick={() => setMode("external")}
          >
            A different job
          </Button>
        </div>

        {mode === "application" ? (
          applicationOptions.length > 0 ? (
            <SelectField
              label="Job"
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              options={applicationOptions}
            />
          ) : (
            <p className="text-sm text-slate-500">
              You haven&rsquo;t applied to any jobs yet.{" "}
              <Link href="/jobs" className="text-indigo-700 hover:underline">
                Browse open jobs
              </Link>
              .
            </p>
          )
        ) : (
          <>
            <TextField
              label="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <TextField label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
            <TextAreaField
              label="Job description (optional, but helps a lot)"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </>
        )}
      </div>

      <TextAreaField
        label="Accomplishments to emphasize (optional)"
        placeholder="Anything specific you want the letter to highlight…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={submit} disabled={submitting}>
        {submitting ? "Generating…" : "Generate cover letter"}
      </Button>
    </div>
  );
}
