"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";

const MAX_FEEDBACK_CHARS = 1000;

export function CoverLetterEditor({
  coverLetterId,
  companyName,
  jobTitle,
  initialHtml,
}: {
  coverLetterId: string;
  companyName: string;
  jobTitle: string;
  initialHtml: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  // The letter is written into the DOM imperatively, once, instead of via
  // dangerouslySetInnerHTML. With that prop React re-applied `initialHtml`
  // on every re-render, which wiped out both the user's typing and the text
  // returned by regenerate (the saved letter changed, but the screen didn't).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editorRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cover-letters/${coverLetterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: editorRef.current.innerHTML }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Couldn't save");
        return;
      }
      setSavedAt(new Date());
    } catch {
      setError("Couldn't reach the server. Your edits are still on screen — try saving again.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!feedback.trim() || !editorRef.current) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cover-letters/${coverLetterId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send what's on screen so the revision builds on any manual edits.
        body: JSON.stringify({ feedback: feedback.trim(), currentHtml: editorRef.current.innerHTML }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't revise the letter");
        return;
      }
      editorRef.current.innerHTML = data.coverLetter.htmlContent;
      setSavedAt(new Date());
      setFeedback("");
      setReviseOpen(false);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setRegenerating(false);
    }
  }

  async function copy() {
    if (!editorRef.current) return;
    try {
      await navigator.clipboard.writeText(editorRef.current.innerText);
    } catch {
      setError("Couldn't copy to clipboard — try selecting the text manually.");
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/cover-letters/${coverLetterId}/export?type=docx`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cover-letter.docx";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {jobTitle} at {companyName}
          </h1>
          <p className="text-xs text-slate-500">
            Click directly into the letter below to edit it.{" "}
            {savedAt && <span className="text-emerald-600">Saved {savedAt.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" onClick={() => setReviseOpen((open) => !open)} disabled={regenerating}>
            Regenerate
          </Button>
          <Button variant="secondary" onClick={copy}>
            Copy
          </Button>
          <Button variant="secondary" onClick={download} disabled={downloading}>
            {downloading ? "Preparing…" : "Download"}
          </Button>
          <Link href="/cover-letters/new">
            <Button variant="ghost">Start over</Button>
          </Link>
        </div>
      </div>

      {reviseOpen && (
        <div className="flex flex-col gap-3 rounded-mw-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <TextAreaField
            label="What would you like to change?"
            name="revision-feedback"
            rows={3}
            maxLength={MAX_FEEDBACK_CHARS}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Make it shorter and more confident, and mention my Python project in the second paragraph."
            disabled={regenerating}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={regenerate} disabled={regenerating || !feedback.trim()}>
              {regenerating ? "Revising…" : "Revise letter"}
            </Button>
            <Button variant="ghost" onClick={() => setReviseOpen(false)} disabled={regenerating}>
              Cancel
            </Button>
            <p className="text-xs text-slate-500">
              Your current text, including any edits you&apos;ve made, is used as the starting point.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[500px] rounded-mw-lg border border-slate-200 bg-[#ffffff] text-[#111827] p-10 outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  );
}
