"use client";

import { useState } from "react";
import { SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "../../lib/types";

export type ApplicantRow = {
  id: string;
  applicantName: string | null;
  applicantEmail: string;
  note: string | null;
  status: ApplicationStatus;
  createdAt: string;
  resumeTitle: string;
  resumeHtml: string;
};

export function ApplicantsList({ initialApplicants }: { initialApplicants: ApplicantRow[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function updateStatus(id: string, status: ApplicationStatus) {
    setSavingId(id);
    const previous = applicants;
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const res = await fetch(`/api/company/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) setApplicants(previous);
    } catch {
      setApplicants(previous);
    } finally {
      setSavingId(null);
    }
  }

  if (applicants.length === 0) {
    return <p className="text-sm text-slate-500">No applicants yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {applicants.map((applicant) => (
        <li key={applicant.id} className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-900">{applicant.applicantName ?? applicant.applicantEmail}</p>
              <p className="text-xs text-slate-500">
                {applicant.applicantEmail} · applied {new Date(applicant.createdAt).toLocaleDateString()}
              </p>
              {applicant.note && <p className="mt-1 text-sm text-slate-700">&ldquo;{applicant.note}&rdquo;</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-40">
                <SelectField
                  label="Status"
                  value={applicant.status}
                  disabled={savingId === applicant.id}
                  onChange={(e) => updateStatus(applicant.id, e.target.value as ApplicationStatus)}
                  options={APPLICATION_STATUSES.map((status) => ({
                    value: status,
                    label: APPLICATION_STATUS_LABELS[status],
                  }))}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => setExpandedId((current) => (current === applicant.id ? null : applicant.id))}
              >
                {expandedId === applicant.id ? "Hide resume" : `View resume: ${applicant.resumeTitle}`}
              </Button>
            </div>
          </div>

          {expandedId === applicant.id && (
            <iframe
              sandbox=""
              srcDoc={applicant.resumeHtml}
              className="mt-4 h-[800px] w-full rounded-md border border-slate-200"
              title={`Resume: ${applicant.resumeTitle}`}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
