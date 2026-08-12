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
        <h1 className="text-2xl font-bold text-white">Session recordings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Only customers who opted in to the consent banner appear here.
        </p>
      </div>

      {recordings.length === 0 ? (
        <p className="text-slate-500">No recordings yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
              {recordings.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-white">{r.user.name ?? r.user.email}</td>
                  <td className="px-4 py-3 text-slate-400">{r.startedAt.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDuration(r.durationMs)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/sessions/${r.id}`} className="text-indigo-400 hover:underline">
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
