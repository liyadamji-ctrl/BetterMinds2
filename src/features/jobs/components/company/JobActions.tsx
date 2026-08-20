"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { JobStatus } from "../../lib/types";

export function JobActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleStatus() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "OPEN" ? "CLOSED" : "OPEN" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this posting? This also deletes its applications.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Link href={`/company/jobs/${jobId}/applicants`}>
          <Button variant="secondary">Applicants</Button>
        </Link>
        <Link href={`/company/jobs/${jobId}/edit`}>
          <Button variant="secondary">Edit</Button>
        </Link>
        <Button variant="secondary" onClick={toggleStatus} disabled={busy}>
          {status === "OPEN" ? "Close" : "Reopen"}
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy}>
          Delete
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
