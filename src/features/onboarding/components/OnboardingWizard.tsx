"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export type Role = "CUSTOMER" | "COMPANY" | "ADMIN";

const SEEKER_FIELDS = [
  {
    name: "targetField",
    label: "What field are you targeting?",
    placeholder: "e.g. Software Engineering, Data Science, Marketing…",
  },
  {
    name: "currentStatus",
    label: "Current status",
    placeholder: "e.g. Undergraduate Student, Recent Graduate, Career Changer",
  },
  {
    name: "location",
    label: "Location",
    placeholder: "e.g. San Francisco, CA",
  },
  {
    name: "linkedin",
    label: "LinkedIn URL (optional)",
    placeholder: "https://linkedin.com/in/yourprofile",
  },
] as const;

const COMPANY_FIELDS = [
  {
    name: "industry",
    label: "Industry",
    placeholder: "e.g. Technology, Finance, Healthcare, Retail…",
  },
  {
    name: "size",
    label: "Company size",
    placeholder: "e.g. 1–10, 11–50, 51–200, 500+",
  },
  {
    name: "website",
    label: "Website (optional)",
    placeholder: "https://yourcompany.com",
  },
  {
    name: "location",
    label: "Headquarters",
    placeholder: "e.g. New York, NY",
  },
] as const;

interface Props {
  initialRole: Role;
}

export function OnboardingWizard({ initialRole }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<"CUSTOMER" | "COMPANY">(
    initialRole === "COMPANY" ? "COMPANY" : "CUSTOMER",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = role === "COMPANY" ? COMPANY_FIELDS : SEEKER_FIELDS;

  async function submit(profileData: Record<string, string>, skip: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          profileData: skip ? undefined : profileData,
          needsOnboarding: false,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      router.push(role === "COMPANY" ? "/company" : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const profileData: Record<string, string> = {};
    for (const field of fields) {
      profileData[field.name] = String(data.get(field.name) ?? "");
    }
    submit(profileData, false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-700">I am a…</p>
        <div className="grid grid-cols-2 gap-3">
          {(["CUSTOMER", "COMPANY"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                role === r
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {r === "CUSTOMER" ? "🎓 Job Seeker" : "🏢 Employer"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm font-medium text-slate-700">
          {role === "COMPANY"
            ? "Tell us about your company (optional — you can fill this in later)"
            : "Tell us about yourself (optional — you can fill this in later)"}
        </p>
        {fields.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            name={field.name}
            placeholder={field.placeholder}
          />
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Save and continue"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => submit({}, true)}
          >
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}
