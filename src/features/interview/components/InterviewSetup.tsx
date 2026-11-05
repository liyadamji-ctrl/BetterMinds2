"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";

type PrefillJob = { jobId: string; jobTitle: string; companyName: string };

const TYPE_OPTIONS = [
  { value: "MIXED", label: "Mixed (behavioral + job-specific)" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "TECHNICAL", label: "Technical / job knowledge" },
];

const COUNT_OPTIONS = [
  { value: "5", label: "5 questions (about 10 min)" },
  { value: "8", label: "8 questions (about 15 min)" },
  { value: "10", label: "10 questions (about 20 min)" },
];

export function InterviewSetup({
  resumes,
  prefillJob,
  invalidJobId,
}: {
  resumes: { id: string; title: string }[];
  prefillJob: PrefillJob | null;
  invalidJobId: boolean;
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState("MIXED");
  const [count, setCount] = useState("8");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = prefillJob ? true : jobTitle.trim().length >= 2;

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: resumeId || undefined,
          ...(prefillJob
            ? { jobId: prefillJob.jobId }
            : {
                jobTitle: jobTitle.trim(),
                companyName: companyName.trim() || undefined,
                jobDescription: jobDescription.trim() || undefined,
              }),
          interviewType,
          count: Number(count),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't set up that interview.");
        return;
      }
      router.push(`/interview/${data.id}`);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-mw-lg bg-surface-raised shadow-mw-card p-5">
      {invalidJobId && (
        <p className="text-sm text-amber-700">That job link wasn&rsquo;t valid, so describe the job below instead.</p>
      )}

      {prefillJob ? (
        <p className="rounded bg-slate-50 p-3 text-sm text-slate-700">
          Interview for <strong>{prefillJob.jobTitle}</strong> at {prefillJob.companyName}.
        </p>
      ) : (
        <>
          <TextField
            label="Job You're Interviewing For"
            name="jobTitle"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. junior data analyst"
            maxLength={150}
            required
          />
          <TextField
            label="Company (optional)"
            name="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={150}
          />
          <TextAreaField
            label="Job Description (optional, makes questions more specific)"
            name="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            maxLength={10000}
          />
        </>
      )}

      {resumes.length > 0 ? (
        <SelectField
          label="Resume to Tailor Questions To"
          name="resumeId"
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          options={[{ value: "", label: "None" }, ...resumes.map((r) => ({ value: r.id, label: r.title }))]}
        />
      ) : (
        <p className="text-xs text-slate-500">
          No resume yet, so questions will be based on the job only.{" "}
          <Link href="/resume-builder" className="text-indigo-700 hover:underline">
            Build one
          </Link>
          .
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Interview Type" name="interviewType" value={interviewType} onChange={(e) => setInterviewType(e.target.value)} options={TYPE_OPTIONS} />
        <SelectField label="Length" name="count" value={count} onChange={(e) => setCount(e.target.value)} options={COUNT_OPTIONS} />
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
        <li>You&rsquo;ll answer out loud (Chrome or Edge) or type. Allow the microphone when asked.</li>
        <li>The camera is optional and analyzed in your browser only; no audio or video is saved.</li>
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Button onClick={start} disabled={submitting || !canSubmit}>
          {submitting ? "Preparing your interview…" : "Start interview"}
        </Button>
      </div>
    </div>
  );
}
