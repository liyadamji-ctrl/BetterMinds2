"use client";

import { useEffect, useRef, useState } from "react";
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

  // AI edit. The editor's selection is lost when focus moves to the
  // instruction box, so the last selection inside the editor is remembered.
  const savedRange = useRef<Range | null>(null);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{
    before: string;
    after: string;
    range: Range | null;
    element: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    function remember() {
      const sel = window.getSelection();
      const editor = editorRef.current;
      if (!sel || sel.rangeCount === 0 || !editor) return;
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
    }
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);

  async function askAi() {
    setAiError(null);
    setSuggestion(null);
    const range = savedRange.current;
    const editor = editorRef.current;
    if (!range || !editor) {
      setAiError("Click a line in the resume, or select some text, first.");
      return;
    }

    let before = range.toString();
    let element: HTMLElement | null = null;
    let target: Range | null = range;
    if (!before.trim()) {
      // Nothing selected: edit the single line/block the cursor is in, but
      // only if it is plain text (replacing a block with child elements would
      // wipe its layout).
      const node = range.startContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
      if (!el || el === editor || el.children.length > 0 || !editor.contains(el)) {
        setAiError("Click inside a line of text, or select the text you want changed.");
        return;
      }
      element = el;
      target = null;
      before = el.textContent ?? "";
    }

    setAiBusy(true);
    try {
      const res = await fetch("/api/cv-to-resume/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: before, instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data.error ?? "Couldn't rewrite that.");
        return;
      }
      setSuggestion({ before, after: data.text, range: target, element });
    } catch {
      setAiError("Couldn't reach the server. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    // Plain text only — the AI's reply is never inserted as HTML.
    if (suggestion.element) {
      suggestion.element.textContent = suggestion.after;
    } else if (suggestion.range) {
      suggestion.range.deleteContents();
      suggestion.range.insertNode(document.createTextNode(suggestion.after));
    }
    setSuggestion(null);
    setInstruction("");
    savedRange.current = null;
  }

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

      <div className="no-print flex flex-col gap-3 rounded-mw-lg border border-indigo-200 bg-indigo-50 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Edit with AI</h2>
          <p className="text-xs text-slate-600">
            Select text in the resume (or click one line), say what to change, and review the result before it is applied.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Make it shorter", "Make it stronger", "Use action verbs", "Fix grammar"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setInstruction(preset)}
              className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-indigo-100"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && instruction.trim().length >= 3 && !aiBusy) void askAi();
            }}
            placeholder="e.g. rewrite for a marketing internship"
            maxLength={300}
            className="flex-1 rounded-mw-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
          />
          <Button onClick={askAi} disabled={aiBusy || instruction.trim().length < 3}>
            {aiBusy ? "Thinking…" : "Rewrite"}
          </Button>
        </div>
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        {suggestion && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-mw-md border border-line bg-surface-raised p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">Before</p>
              <p className="whitespace-pre-line text-slate-700">{suggestion.before}</p>
            </div>
            <div className="rounded-mw-md border border-emerald-200 bg-white p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase text-emerald-700">After</p>
              <p className="whitespace-pre-line text-slate-900">{suggestion.after}</p>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button onClick={acceptSuggestion}>Use This</Button>
              <Button variant="ghost" onClick={() => setSuggestion(null)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className="min-h-[500px] rounded-mw-lg border border-slate-200 bg-[#ffffff] text-[#111827] p-10 outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </div>
  );
}
