"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "../../lib/types";

export function ApplyButton({
  jobId,
  resumes,
  initialStatus,
}: {
  jobId: string;
  resumes: { id: string; title: string }[];
  initialStatus: ApplicationStatus | null;
}) {
  const [status, setStatus] = useState<ApplicationStatus | null>(initialStatus);
  const [open, setOpen] = useState(false);
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        You&rsquo;ve applied to this job. Status: {APPLICATION_STATUS_LABELS[status]}
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        You need a resume before applying.{" "}
        <Link href="/resume-builder" className="text-indigo-700 hover:underline">
          Build one now
        </Link>
        .
      </div>
    );
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Apply</Button>;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setStatus(data.status as ApplicationStatus);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <SelectField
        label="Resume to send"
        value={resumeId}
        onChange={(e) => setResumeId(e.target.value)}
        options={resumes.map((r) => ({ value: r.id, label: r.title }))}
      />
      <TextAreaField
        label="Note (optional)"
        placeholder="Anything you'd like to add…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
