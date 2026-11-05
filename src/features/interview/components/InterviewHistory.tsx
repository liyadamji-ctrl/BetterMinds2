"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export type InterviewRow = {
  id: string;
  jobTitle: string;
  companyName: string | null;
  status: string;
  overallScore: number | null;
  answered: number;
  total: number;
  createdAt: string;
};

export function InterviewHistory({ initialRows }: { initialRows: InterviewRow[] }) {
  const [rows, setRows] = useState(initialRows);

  async function remove(id: string) {
    if (!confirm("Delete this interview and its report? This can't be undone.")) return;
    const previous = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/interview/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) setRows(previous);
    } catch {
      setRows(previous);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-mw-lg bg-surface-raised shadow-mw-card p-10 text-center">
        <p className="text-slate-600">You haven&rsquo;t practiced an interview yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-mw-lg bg-surface-raised shadow-mw-card">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <Link href={`/interview/${row.id}`} className="font-medium text-slate-900 hover:underline">
              {row.jobTitle}
              {row.companyName ? ` at ${row.companyName}` : ""}
            </Link>
            <p className="text-xs text-slate-500">
              {new Date(row.createdAt).toLocaleDateString()} ·{" "}
              {row.status === "COMPLETED" ? `Score ${row.overallScore ?? "–"}/100` : `In progress (${row.answered}/${row.total})`}
            </p>
          </div>
          <Button variant="ghost" onClick={() => remove(row.id)}>
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}
