"use client";

import { useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SelectField, TextField } from "@/components/ui/Field";
import { EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from "../../lib/types";

export function JobFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const type = searchParams.get("type") ?? "";
  const q = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value), 300);
  }

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
      <TextField
        label="Search"
        placeholder="Search job titles…"
        defaultValue={q}
        onChange={(e) => handleSearchChange(e.target.value)}
      />
      <SelectField
        label="Employment type"
        value={type}
        onChange={(e) => updateParam("type", e.target.value)}
        options={[
          { value: "", label: "All types" },
          ...EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABELS[t] })),
        ]}
      />
    </div>
  );
}
