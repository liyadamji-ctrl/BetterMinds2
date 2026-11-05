"use client";

import { useMemo, useState } from "react";
import { SelectField, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "../../lib/types";
import {
  RECOMMENDATION_LABELS,
  type Recommendation,
  type ScreeningResult,
} from "@/features/screening/lib/screeningSchema";

export type ApplicantRow = {
  id: string;
  applicantName: string | null;
  applicantEmail: string;
  note: string | null;
  status: ApplicationStatus;
  createdAt: string;
  resumeTitle: string;
  resumeHtml: string;
  matchScore: number | null;
  screening: ScreeningResult | null;
};

type ScreenResponse = {
  screened?: Array<{ id: string; matchScore: number; screening: ScreeningResult }>;
  failed?: number;
  error?: string;
};

type SortKey = "newest" | "score";
type FilterKey = "ALL" | Recommendation | "UNSCREENED";

const BADGE_STYLES: Record<Recommendation, string> = {
  STRONG_MATCH: "bg-emerald-100 text-emerald-800",
  POSSIBLE: "bg-amber-100 text-amber-800",
  WEAK: "bg-slate-200 text-slate-700",
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ApplicantsList({ jobId, initialApplicants }: { jobId: string; initialApplicants: ApplicantRow[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [screening, setScreening] = useState(false);
  const [screenMessage, setScreenMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [minScore, setMinScore] = useState("");

  const unscreenedCount = applicants.filter((a) => !a.screening).length;
  const strongMatches = applicants.filter(
    (a) => a.screening?.recommendation === "STRONG_MATCH" && a.status !== "SHORTLISTED"
  );

  const visible = useMemo(() => {
    const min = minScore === "" ? null : Number(minScore);
    const rows = applicants.filter((a) => {
      if (filter === "UNSCREENED" && a.screening) return false;
      if (filter !== "ALL" && filter !== "UNSCREENED" && a.screening?.recommendation !== filter) return false;
      if (min !== null && !Number.isNaN(min) && (a.matchScore ?? -1) < min) return false;
      return true;
    });
    if (sort === "score") rows.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
    return rows;
  }, [applicants, sort, filter, minScore]);

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

  async function runScreening(force: boolean) {
    setScreening(true);
    setScreenMessage(null);
    try {
      const res = await fetch(`/api/company/jobs/${jobId}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json().catch(() => ({}))) as ScreenResponse;
      if (!res.ok) {
        setScreenMessage({ text: data.error ?? "Couldn't screen applicants. Please try again.", isError: true });
        return;
      }
      const results = new Map((data.screened ?? []).map((r) => [r.id, r]));
      setApplicants((prev) =>
        prev.map((a) => {
          const r = results.get(a.id);
          return r ? { ...a, matchScore: r.matchScore, screening: r.screening } : a;
        })
      );
      if (results.size > 0) setSort("score");
      const failed = data.failed ?? 0;
      setScreenMessage({
        text:
          `Screened ${results.size} applicant${results.size === 1 ? "" : "s"}.` +
          (failed > 0 ? ` ${failed} couldn't be screened — try again.` : ""),
        isError: failed > 0,
      });
    } catch {
      setScreenMessage({ text: "Couldn't screen applicants. Please try again.", isError: true });
    } finally {
      setScreening(false);
    }
  }

  async function shortlistStrongMatches() {
    for (const applicant of strongMatches) await updateStatus(applicant.id, "SHORTLISTED");
  }

  if (applicants.length === 0) {
    return <p className="text-sm text-slate-500">No applicants yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-ts-lg border border-line bg-surface shadow-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => runScreening(false)} disabled={screening || unscreenedCount === 0}>
            {screening
              ? "Screening…"
              : unscreenedCount === 0
                ? "All screened"
                : `Screen with AI (${unscreenedCount})`}
          </Button>
          {unscreenedCount < applicants.length && (
            <Button variant="secondary" onClick={() => runScreening(true)} disabled={screening}>
              Re-screen all
            </Button>
          )}
          {strongMatches.length > 0 && (
            <Button variant="secondary" onClick={shortlistStrongMatches} disabled={screening || savingId !== null}>
              Shortlist {strongMatches.length} strong match{strongMatches.length === 1 ? "" : "es"}
            </Button>
          )}
          {screenMessage && (
            <p className={`text-sm ${screenMessage.isError ? "text-red-600" : "text-slate-600"}`} role="status">
              {screenMessage.text}
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          AI scores each resume against this job&apos;s description and requirements, with contact details removed
          first. It is a suggestion to help you prioritize — you decide who moves forward.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SelectField
            label="Sort By"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "score", label: "Highest AI score" },
            ]}
          />
          <SelectField
            label="Show"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            options={[
              { value: "ALL", label: "All applicants" },
              { value: "STRONG_MATCH", label: RECOMMENDATION_LABELS.STRONG_MATCH },
              { value: "POSSIBLE", label: RECOMMENDATION_LABELS.POSSIBLE },
              { value: "WEAK", label: RECOMMENDATION_LABELS.WEAK },
              { value: "UNSCREENED", label: "Not screened yet" },
            ]}
          />
          <TextField
            label="Minimum Score"
            type="number"
            min={0}
            max={100}
            placeholder="0–100"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 && <p className="text-sm text-slate-500">No applicants match those filters.</p>}

      <ul className="flex flex-col gap-3">
        {visible.map((applicant) => (
          <li key={applicant.id} className="rounded-ts-lg border border-line bg-surface shadow-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{applicant.applicantName ?? applicant.applicantEmail}</p>
                  {applicant.screening && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[applicant.screening.recommendation]}`}
                    >
                      {applicant.matchScore}/100 · {RECOMMENDATION_LABELS[applicant.screening.recommendation]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {applicant.applicantEmail} · applied {new Date(applicant.createdAt).toLocaleDateString()}
                </p>
                {applicant.note && <p className="mt-1 text-sm text-slate-700">&ldquo;{applicant.note}&rdquo;</p>}
                {applicant.screening?.summary && (
                  <p className="mt-2 text-sm text-slate-700">{applicant.screening.summary}</p>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-40">
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
                  {expandedId === applicant.id ? "Hide details" : "View details"}
                </Button>
              </div>
            </div>

            {expandedId === applicant.id && (
              <div className="mt-4 flex flex-col gap-4">
                {applicant.screening && (
                  <div className="flex flex-col gap-3 rounded-ts-md bg-slate-50 p-4">
                    <ListBlock title="Matched Skills" items={applicant.screening.matchedSkills} />
                    <ListBlock title="Missing Requirements" items={applicant.screening.missingRequirements} />
                    {applicant.screening.experienceFit && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience fit</p>
                        <p className="mt-1 text-sm text-slate-700">{applicant.screening.experienceFit}</p>
                      </div>
                    )}
                    <ListBlock title="Red Flags" items={applicant.screening.redFlags} />
                  </div>
                )}
                <iframe
                  sandbox=""
                  srcDoc={applicant.resumeHtml}
                  className="h-[800px] w-full rounded-ts-md border border-line bg-[#ffffff]"
                  title={`Resume: ${applicant.resumeTitle}`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
