import { db } from "@/lib/db";

async function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [customerCount, resumeCount, recordingCount, consentedCount] = await Promise.all([
    db.profile.count({ where: { role: "CUSTOMER" } }),
    db.resume.count(),
    db.sessionRecording.count(),
    db.consent.count({ where: { sessionRecordingAllowed: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value={customerCount} />
        <StatCard label="Resumes built" value={resumeCount} />
        <StatCard label="Session recordings" value={recordingCount} />
        <StatCard label="Customers who opted in to recording" value={consentedCount} />
      </div>
      <p className="text-sm text-slate-500">
        More analytics — feature-usage breakdowns, acquisition sources, per-resume analysis
        history — are great features to add as you build out the platform.
      </p>
    </div>
  );
}
