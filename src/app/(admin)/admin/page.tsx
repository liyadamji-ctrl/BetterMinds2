import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/teamstead/ui";

const SHORTCUTS = [
  ["/admin/analyses", "Resume analyses", "Every analysed resume, who it belongs to and the job it was checked against."],
  ["/admin/features", "Feature usage", "Which features customers and companies use the most."],
  ["/admin/companies", "Companies", "Job postings and whether AI screening is working for each company."],
];

export default async function AdminOverviewPage() {
  const [customerCount, resumeCount, recordingCount, consentedCount] = await Promise.all([
    db.profile.count({ where: { role: "CUSTOMER" } }),
    db.resume.count(),
    db.sessionRecording.count(),
    db.consent.count({ where: { sessionRecordingAllowed: true } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Overview" description="How customers and companies are using the platform." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Customers" value={customerCount} />
        <StatCard label="Resumes built" value={resumeCount} />
        <StatCard label="Session recordings" value={recordingCount} />
        <StatCard label="Customers who opted in to recording" value={consentedCount} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map(([href, title, body]) => (
          <Link
            key={href}
            href={href}
            className="rounded-ts-lg border border-line bg-surface p-5 shadow-card transition-colors hover:border-navy"
          >
            <p className="font-display text-[18px] font-semibold text-ocean">{title}</p>
            <p className="mt-1 text-sm text-ink-muted">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
