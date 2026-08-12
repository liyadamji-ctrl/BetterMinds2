import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SessionPlayer } from "@/features/session-recording/components/SessionPlayer";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import type { eventWithTime } from "rrweb";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recording = await db.sessionRecording.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!recording) notFound();

  const events = JSON.parse(recording.events) as eventWithTime[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{recording.user.name}&rsquo;s session</h1>
        <p className="mt-1 text-sm text-slate-400">
          {recording.user.email} · started {recording.startedAt.toLocaleString()}
        </p>
      </div>
      <AppErrorBoundary scope="admin:session-player">
        <div className="rounded-lg bg-white p-2">
          <SessionPlayer events={events} />
        </div>
      </AppErrorBoundary>
    </div>
  );
}
