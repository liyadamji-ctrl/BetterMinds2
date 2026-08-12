"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { emptyAnswers, type ResumeSection, type ResumeAnswers, type SimpleField } from "../formats/types";

/**
 * Only the serializable parts of a ResumeFormat — `render` is a function
 * and can't cross the Server -> Client Component boundary, so the page
 * that renders this deliberately passes this narrower shape instead of
 * the full format object.
 */
export type WizardFormat = { id: string; name: string; sections: ResumeSection[] };

function Field({
  field,
  value,
  onChange,
}: {
  field: SimpleField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <TextAreaField
        label={field.label}
        placeholder={field.placeholder}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <TextField
      label={field.label}
      type={field.type}
      placeholder={field.placeholder}
      required={field.required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function WizardForm({ format }: { format: WizardFormat }) {
  const router = useRouter();
  const [title, setTitle] = useState(`My ${format.name} Resume`);
  const [answers, setAnswers] = useState<ResumeAnswers>(() => emptyAnswers(format.sections));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSimple(sectionId: string, fieldId: string, value: string) {
    setAnswers((prev) => {
      const current = prev[sectionId];
      const record = Array.isArray(current) ? {} : current;
      return { ...prev, [sectionId]: { ...record, [fieldId]: value } };
    });
  }

  function addItem(sectionId: string, itemFields: SimpleField[]) {
    setAnswers((prev) => {
      const current = prev[sectionId];
      const list = Array.isArray(current) ? current : [];
      const blank = Object.fromEntries(itemFields.map((f) => [f.id, ""]));
      return { ...prev, [sectionId]: [...list, blank] };
    });
  }

  function updateItem(sectionId: string, index: number, fieldId: string, value: string) {
    setAnswers((prev) => {
      const current = prev[sectionId];
      const list = Array.isArray(current) ? [...current] : [];
      list[index] = { ...list[index], [fieldId]: value };
      return { ...prev, [sectionId]: list };
    });
  }

  function removeItem(sectionId: string, index: number) {
    setAnswers((prev) => {
      const current = prev[sectionId];
      const list = Array.isArray(current) ? [...current] : [];
      list.splice(index, 1);
      return { ...prev, [sectionId]: list };
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: format.id, title, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(`/resume-builder/edit/${data.id}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <TextField label="Resume title (just for your own reference)" value={title} onChange={(e) => setTitle(e.target.value)} />

      {format.sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-slate-900">{section.title}</h2>

          {section.kind === "simple" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <Field
                    field={field}
                    value={(() => {
                      const record = answers[section.id];
                      return !Array.isArray(record) ? (record?.[field.id] ?? "") : "";
                    })()}
                    onChange={(value) => updateSimple(section.id, field.id, value)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {(Array.isArray(answers[section.id]) ? (answers[section.id] as Array<Record<string, string>>) : []).map(
                (item, index) => (
                  <div key={index} className="rounded-md border border-slate-200 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.itemFields.map((field) => (
                        <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                          <Field
                            field={field}
                            value={item[field.id] ?? ""}
                            onChange={(value) => updateItem(section.id, index, field.id, value)}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(section.id, index)}
                      className="mt-3 text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )
              )}
              <Button variant="secondary" type="button" onClick={() => addItem(section.id, section.itemFields)}>
                {section.addLabel}
              </Button>
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Building your resume…" : "Build my resume"}
      </Button>
    </div>
  );
}
