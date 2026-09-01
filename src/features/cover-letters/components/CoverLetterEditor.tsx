"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
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
    if (
      !confirm(
        "Regenerating will discard any edits you've made since this letter was last generated or saved. Continue?"
      )
    ) {
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cover-letters/${coverLetterId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't regenerate");
        return;
      }
      if (editorRef.current) editorRef.current.innerHTML = data.coverLetter.htmlContent;
      setSavedAt(new Date());
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
          <Button variant="secondary" onClick={regenerate} disabled={regenerating}>
            {regenerating ? "Regenerating…" : "Regenerate"}
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className="min-h-[500px] rounded-lg border border-slate-200 bg-white p-10 outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  );
}
