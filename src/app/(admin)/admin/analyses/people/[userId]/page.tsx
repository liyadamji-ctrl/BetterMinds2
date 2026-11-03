import Link from "next/link";
import { notFound } from "next/navigation";
import { getPersonTimeline } from "@/features/analytics/lib/analysisAdmin";
import { ScoreBadge } from "@/features/analytics/components/AnalysisParts";

export default async function AdminAnalysisPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  // Not a UUID -> can't be a profile id; avoids a database error on junk URLs.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) notFound();
  const timeline = await getPersonTimeline(userId);
  if (!timeline) notFound();
  const { person, analyses, jobs } = timeline;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/analyses/people" className="text-sm text-forest hover:underline">
          ← All people
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">{person.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {person.email} · {analyses.length} {analyses.length === 1 ? "analysis" : "analyses"} across {jobs.length}{" "}
          {jobs.length === 1 ? "job" : "different jobs"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink">Jobs they analysed resumes against</h2>
        <div className="flex flex-wrap gap-2">
          {jobs.map((j) => (
            <span key={j.jobTitle} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink">
              {j.jobTitle}
              <span className="text-xs text-ink-muted">
                ×{j.count} · best {j.bestScore ?? "—"}
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink">Timeline</h2>
        <div className="overflow-x-auto rounded-ts-lg border border-line">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-surface text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Resume file</th>
                <th className="px-4 py-3 font-medium">Analysed against job</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {analyses.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-ink-muted">{a.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink">{a.fileName ?? <span className="text-ink-muted">Pasted text</span>}</td>
                  <td className="px-4 py-3 text-ink">{a.jobTitle}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={a.matchScore} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/analyses/${a.id}`} className="text-forest hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
