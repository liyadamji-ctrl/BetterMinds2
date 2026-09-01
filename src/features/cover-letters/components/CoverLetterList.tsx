"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export type CoverLetterRow = {
  id: string;
  companyName: string;
  jobTitle: string;
  createdAt: string;
};

export function CoverLetterList({ initialCoverLetters }: { initialCoverLetters: CoverLetterRow[] }) {
  const [coverLetters, setCoverLetters] = useState(initialCoverLetters);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this cover letter? This can't be undone.")) return;
    setDeletingId(id);
    const previous = coverLetters;
    setCoverLetters((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/cover-letters/${id}`, { method: "DELETE" });
      if (!res.ok) setCoverLetters(previous);
    } catch {
      setCoverLetters(previous);
    } finally {
      setDeletingId(null);
    }
  }

  if (coverLetters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-600">You haven&rsquo;t written any cover letters yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {coverLetters.map((coverLetter) => (
        <li key={coverLetter.id} className="flex items-center justify-between px-5 py-4">
          <div>
            <Link href={`/cover-letters/${coverLetter.id}`} className="font-medium text-slate-900 hover:underline">
              {coverLetter.jobTitle} at {coverLetter.companyName}
            </Link>
            <p className="text-xs text-slate-500">{new Date(coverLetter.createdAt).toLocaleDateString()}</p>
          </div>
          <Button variant="ghost" onClick={() => remove(coverLetter.id)} disabled={deletingId === coverLetter.id}>
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}
