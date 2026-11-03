import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnalysisDetail } from "@/features/analytics/lib/analysisAdmin";
import { ScoreBadge } from "@/features/analytics/components/AnalysisParts";
import { ResumeTextView } from "@/features/analytics/components/ResumeTextView";
import { prepareResumeForAdmin } from "@/features/analytics/lib/resumeDisplay";
import { analysisResultSchema, type AnalysisResult } from "@/features/resume-analyzer/lib/analysisSchema";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm text-ink">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminAnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysisDetail(id);
  if (!analysis) notFound();

  let result: AnalysisResult | null = null;
  try {
    result = analysisResultSchema.parse(JSON.parse(analysis.resultJson));
  } catch {
    result = null;
  }
  const personName = analysis.user.name ?? analysis.user.email;

  let location: string | null = null;
  try {
    const profile = analysis.user.profileJson ? (JSON.parse(analysis.user.profileJson) as Record<string, string>) : null;
    location = profile?.location?.trim() || null;
  } catch {
    location = null;
  }
  const resume = prepareResumeForAdmin(analysis.resumeText, {
    name: analysis.user.name,
    email: analysis.user.email,
    location,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/analyses" className="text-sm text-forest hover:underline">
          ← All analyses
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.015em] text-ink sm:text-[36px] sm:leading-[42px]">{analysis.jobTitle}</h1>
          <ScoreBadge score={analysis.matchScore} />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          <Link href={`/admin/analyses/people/${analysis.user.id}`} className="text-forest hover:underline">
            {personName}
          </Link>{" "}
          ({analysis.user.email}) · {analysis.fileName ?? "Pasted text"} · {analysis.createdAt.toLocaleString()}
        </p>
        <p className="mt-1 text-sm">
          <Link href={`/admin/analyses/people/${analysis.user.id}`} className="text-forest hover:underline">
            See everything {personName} has analysed →
          </Link>
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-ts-lg border border-line bg-surface p-5">
        <h2 className="font-semibold text-ink">What our AI told them</h2>
        {result ? (
          <>
            {result.summary && <p className="text-sm text-ink">{result.summary}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <List title="Strengths" items={result.strengths} />
              <List title="Gaps" items={result.gaps} />
              <List title="Suggestions" items={result.suggestions} />
              <List title="Missing keywords" items={result.missingKeywords} />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">The stored result for this analysis could not be read.</p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-ts-lg border border-line bg-surface p-5">
        <h2 className="font-semibold text-ink">Job they analysed against</h2>
        {analysis.jobDescription ? (
          <p className="whitespace-pre-wrap text-sm text-ink">{analysis.jobDescription}</p>
        ) : (
          <p className="text-sm text-ink-muted">No job description was provided, so the AI judged against the title alone.</p>
        )}
      </section>

      <details className="rounded-ts-lg border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-ink">Resume text (personal details removed)</summary>
        <div className="mt-4">
          <ResumeTextView resume={resume} />
        </div>
      </details>
    </div>
  );
}
