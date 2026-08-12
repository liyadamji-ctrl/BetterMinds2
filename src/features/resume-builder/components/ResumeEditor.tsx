"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExportButtons } from "./ExportButtons";

export function ResumeEditor({
  resumeId,
  title,
  initialHtml,
}: {
  resumeId: string;
  title: string;
  initialHtml: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editorRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">
            Click directly into the resume below to edit it.{" "}
            {savedAt && <span className="text-emerald-600">Saved {savedAt.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <ExportButtons resumeId={resumeId} />
        </div>
      </div>

      {error && <p className="no-print text-sm text-red-600">{error}</p>}

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
