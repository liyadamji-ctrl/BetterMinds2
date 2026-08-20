"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField } from "@/components/ui/Field";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type EmploymentType,
  type LocationType,
} from "../../lib/types";

export type JobFormInitial = {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  employmentType: EmploymentType;
  hoursPerWeek: number | null;
  weeksPerYear: number | null;
  pay: string | null;
  location: string | null;
  locationType: LocationType;
};

type Props = { mode: "create" } | { mode: "edit"; job: JobFormInitial };

export function JobForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.job : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requirements, setRequirements] = useState(initial?.requirements ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initial?.employmentType ?? "FULL_TIME");
  const [hoursPerWeek, setHoursPerWeek] = useState(initial?.hoursPerWeek?.toString() ?? "");
  const [weeksPerYear, setWeeksPerYear] = useState(initial?.weeksPerYear?.toString() ?? "");
  const [pay, setPay] = useState(initial?.pay ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [locationType, setLocationType] = useState<LocationType>(initial?.locationType ?? "ON_SITE");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      description,
      requirements: requirements.trim() || undefined,
      employmentType,
      hoursPerWeek: hoursPerWeek.trim() ? Number(hoursPerWeek) : undefined,
      weeksPerYear: weeksPerYear.trim() ? Number(weeksPerYear) : undefined,
      pay: pay.trim() || undefined,
      location: location.trim() || undefined,
      locationType,
    };

    try {
      const url = props.mode === "create" ? "/api/company/jobs" : `/api/company/jobs/${props.job.id}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/company/jobs");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <TextField label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <TextAreaField
        label="Role description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <TextAreaField
        label="Requirements / qualifications (optional)"
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Employment type"
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
          options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_TYPE_LABELS[type] }))}
        />
        <SelectField
          label="Location type"
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as LocationType)}
          options={LOCATION_TYPES.map((type) => ({ value: type, label: LOCATION_TYPE_LABELS[type] }))}
        />
        <TextField
          label="Hours per week (optional)"
          type="number"
          min={1}
          max={168}
          value={hoursPerWeek}
          onChange={(e) => setHoursPerWeek(e.target.value)}
        />
        <TextField
          label="Weeks per year (optional)"
          type="number"
          min={1}
          max={52}
          value={weeksPerYear}
          onChange={(e) => setWeeksPerYear(e.target.value)}
        />
        <TextField
          label="Pay (optional)"
          placeholder="e.g. $20/hr or Unpaid"
          value={pay}
          onChange={(e) => setPay(e.target.value)}
        />
        <TextField
          label="Location (optional)"
          placeholder="e.g. Austin, TX"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Saving…" : props.mode === "create" ? "Post job" : "Save changes"}
      </Button>
    </div>
  );
}
