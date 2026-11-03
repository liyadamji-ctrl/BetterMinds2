"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import {
  buildInternshipLinks,
  buildProgramLinks,
  type InternshipFilters,
  type ProgramFilters,
} from "../lib/providers";

export type Kind = "PROGRAM" | "INTERNSHIP";

export type SavedSearch = {
  id: string;
  query: string;
  area: string;
  location: string;
  level: string;
  freeOnly: boolean;
  remote: boolean;
  jobType: string;
  keywords: string[];
  createdAt: string;
};

const COPY = {
  PROGRAM: {
    queryLabel: "What do you want to learn?",
    queryPlaceholder: "e.g. data analysis, public speaking, UX design",
    linkVerb: "courses",
  },
  INTERNSHIP: {
    queryLabel: "Role you want",
    queryPlaceholder: "e.g. marketing intern, software engineer",
    linkVerb: "openings",
  },
} as const;

const LEVEL_OPTIONS = [
  { value: "", label: "Any level" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const JOB_TYPE_OPTIONS = [
  { value: "internship", label: "Internships" },
  { value: "job", label: "Full-time jobs" },
];

export function DiscoverySearch({ kind, initialSearches }: { kind: Kind; initialSearches: SavedSearch[] }) {
  const copy = COPY[kind];
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [level, setLevel] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [remote, setRemote] = useState(false);
  const [jobType, setJobType] = useState("internship");
  const [useAi, setUseAi] = useState(true);

  const [searches, setSearches] = useState(initialSearches);
  const [current, setCurrent] = useState<SavedSearch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function search() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/discovery/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          query: query.trim(),
          area: area.trim() || undefined,
          location: location.trim() || undefined,
          level: kind === "PROGRAM" ? level : undefined,
          freeOnly: kind === "PROGRAM" ? freeOnly : undefined,
          remote: kind === "INTERNSHIP" ? remote : undefined,
          jobType: kind === "INTERNSHIP" ? jobType : undefined,
          useAi,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't run that search.");
        return;
      }
      const saved: SavedSearch = {
        id: data.id,
        query: query.trim(),
        area: area.trim(),
        location: location.trim(),
        level,
        freeOnly,
        remote,
        jobType,
        keywords: data.keywords,
        createdAt: data.createdAt,
      };
      setSearches((prev) => [saved, ...prev]);
      setCurrent(saved);
      if (useAi && !data.aiUsed) setNotice("AI keyword suggestions weren't available, so we used your exact words.");
    } catch {
      setError("Couldn't run that search. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reopen(item: SavedSearch) {
    setCurrent(item);
    setNotice(null);
    setQuery(item.query);
    setArea(item.area);
    setLocation(item.location);
    setLevel(item.level);
    setFreeOnly(item.freeOnly);
    setRemote(item.remote);
    setJobType(item.jobType);
  }

  async function remove(id: string) {
    const previous = searches;
    setSearches((prev) => prev.filter((s) => s.id !== id));
    if (current?.id === id) setCurrent(null);
    try {
      const res = await fetch(`/api/discovery/searches/${id}`, { method: "DELETE" });
      if (!res.ok) setSearches(previous);
    } catch {
      setSearches(previous);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="flex flex-col gap-4 rounded-mw-lg bg-surface-raised shadow-mw-card p-5"
      >
        <TextField
          label={copy.queryLabel}
          name="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.queryPlaceholder}
          maxLength={100}
          required
        />

        {kind === "PROGRAM" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Level" name="level" value={level} onChange={(e) => setLevel(e.target.value)} options={LEVEL_OPTIONS} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
              Free courses only
            </label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Area / field (optional)" name="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. fintech, healthcare" maxLength={100} />
            <TextField label="Location (optional)" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai, London" maxLength={100} disabled={remote} />
            <SelectField label="Looking for" name="jobType" value={jobType} onChange={(e) => setJobType(e.target.value)} options={JOB_TYPE_OPTIONS} />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
              Remote only
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Improve my search with AI keyword suggestions
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <Button type="submit" disabled={submitting || query.trim().length < 2}>
            {submitting ? "Searching..." : "Find links"}
          </Button>
        </div>
      </form>

      {current && <Results kind={kind} search={current} notice={notice} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Your past searches</h2>
        {searches.length === 0 ? (
          <p className="text-sm text-slate-500">No saved searches yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-mw-lg bg-surface-raised shadow-mw-card">
            {searches.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-5 py-3">
                <button type="button" onClick={() => reopen(item)} className="text-left">
                  <span className="font-medium text-slate-900 hover:underline">{item.query}</span>
                  <span className="block text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                </button>
                <Button variant="ghost" onClick={() => remove(item.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Results({ kind, search, notice }: { kind: Kind; search: SavedSearch; notice: string | null }) {
  const [active, setActive] = useState(0);
  const keyword = search.keywords[active] ?? search.keywords[0] ?? search.query;
  const copy = COPY[kind];

  const links =
    kind === "PROGRAM"
      ? buildProgramLinks(keyword, { level: search.level, freeOnly: search.freeOnly } satisfies ProgramFilters)
      : buildInternshipLinks(
          [keyword, search.area].filter(Boolean).join(" "),
          { location: search.location, remote: search.remote, jobType: search.jobType } satisfies InternshipFilters
        );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-900">Where to find {copy.linkVerb}</h2>
      {notice && <p className="text-sm text-slate-500">{notice}</p>}

      {search.keywords.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Searching for:</span>
          {search.keywords.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full border px-3 py-1 ${
                i === active ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.id} className="flex flex-col gap-2 rounded-mw-lg bg-surface-raised shadow-mw-card p-4">
            <span className="font-medium text-slate-900">{link.name}</span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              See all &ldquo;{keyword}&rdquo; {copy.linkVerb} &rarr;
            </a>
            {link.note && <p className="text-xs text-slate-500">{link.note}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        These open each site&rsquo;s own search results in a new tab. Results and filters are controlled by those sites.
      </p>
    </section>
  );
}
