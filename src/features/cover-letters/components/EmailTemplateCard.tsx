"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";

type Props = {
  id: string;
  title: string;
  subject: string;
  body: string;
};

/**
 * One email template that can be opened and edited in place. Edits are kept
 * in this browser (localStorage) so a template is still tailored when the
 * person comes back; "Reset" restores the original wording. Copy always
 * copies the current, edited text.
 */
export function EmailTemplateCard({ id, title, subject, body }: Props) {
  const storageKey = `prepped-email-template:${id}`;
  const [open, setOpen] = useState(false);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { subject?: string; body?: string };
        if (typeof parsed.subject === "string") setDraftSubject(parsed.subject);
        if (typeof parsed.body === "string") setDraftBody(parsed.body);
      }
    } catch {
      // Storage unavailable or corrupt: just show the original template.
    }
  }, [storageKey]);

  function save(nextSubject: string, nextBody: string) {
    setDraftSubject(nextSubject);
    setDraftBody(nextBody);
    try {
      if (nextSubject === subject && nextBody === body) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify({ subject: nextSubject, body: nextBody }));
    } catch {
      // Edits still work for this visit even if they can't be remembered.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${draftSubject}\n\n${draftBody}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail; the text is on screen to select by hand.
    }
  }

  const edited = draftSubject !== subject || draftBody !== body;

  return (
    <div className="rounded-mw-lg bg-surface-raised p-6 shadow-mw-card">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={`template-${id}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-mw-md text-left"
        >
          <ChevronDown
            size={18}
            strokeWidth={1.6}
            aria-hidden
            className={`mt-1 flex-none text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="min-w-0">
            <span className="block font-semibold text-slate-900">
              {title}
              {edited && <span className="ml-2 text-xs font-medium text-ink-muted">Edited</span>}
            </span>
            <span className="mt-1 block text-xs uppercase tracking-wide text-slate-500">Subject: {draftSubject}</span>
          </span>
        </button>
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      {open ? (
        <div id={`template-${id}`} className="mt-4 flex flex-col gap-4">
          <TextField label="Subject" name={`subject-${id}`} value={draftSubject} onChange={(e) => save(e.target.value, draftBody)} />
          <TextAreaField
            label="Email"
            name={`body-${id}`}
            rows={Math.min(18, Math.max(8, draftBody.split("\n").length + 1))}
            value={draftBody}
            onChange={(e) => save(draftSubject, e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-ink-muted">Fill in the [bracketed] details. Your edits are saved in this browser.</p>
            {edited && (
              <Button variant="ghost" onClick={() => save(subject, body)}>
                Reset to Original
              </Button>
            )}
          </div>
        </div>
      ) : (
        <pre
          id={`template-${id}`}
          className="mt-4 line-clamp-4 whitespace-pre-wrap font-sans text-sm text-slate-700"
        >
          {draftBody}
        </pre>
      )}
    </div>
  );
}
