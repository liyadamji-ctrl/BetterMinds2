import Link from "next/link";
import { db } from "@/lib/db";

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

export default async function AdminSessionsPage() {
  const recordings = await db.sessionRecording.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ocean sm:text-[36px] sm:leading-[42px]">Session recordings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Only customers who opted in to the consent banner appear here.
        </p>
      </div>

      {recordings.length === 0 ? (
        <p className="text-ink-muted">No recordings yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-ts-lg border border-line">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {recordings.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-ink">{r.user.name ?? r.user.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.startedAt.toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDuration(r.durationMs)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/sessions/${r.id}`} className="text-navy hover:underline">
                      Replay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
