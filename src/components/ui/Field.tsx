import { type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export function TextField({ label, error, id, className = "", ...props }: InputProps) {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={fieldId}
        className={`rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export function TextAreaField({ label, error, id, className = "", ...props }: TextareaProps) {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={`min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
