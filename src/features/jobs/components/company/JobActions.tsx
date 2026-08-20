"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { JobStatus } from "../../lib/types";

export function JobActions({ jobId, status }: { jobId: string; status: JobStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleStatus() {
    setBusy(true);
    try {
      await fetch(`/api/company/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "OPEN" ? "CLOSED" : "OPEN" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this posting? This also deletes its applications.")) return;
    setBusy(true);
    try {
      await fetch(`/api/company/jobs/${jobId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
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
  );
}
