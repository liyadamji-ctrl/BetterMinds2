import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { ResumeAnalyzer } from "@/features/resume-analyzer/components/ResumeAnalyzer";
import type { ResumeAnalysisSummary } from "@/features/resume-analyzer/lib/analysisSchema";

export default async function ResumeAnalyzerPage() {
  const session = await requireUser();

  const rows = await db.resumeAnalysis.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, jobTitle: true, matchScore: true, createdAt: true },
  });

  const initialHistory: ResumeAnalysisSummary[] = rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    jobTitle: row.jobTitle,
    matchScore: row.matchScore,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analyze your resume</h1>
        <p className="mt-1 text-slate-600">
          Upload a resume and tell us the job you&rsquo;re targeting — we&rsquo;ll score the match and suggest
          improvements.
        </p>
      </div>
      <ResumeAnalyzer initialHistory={initialHistory} />
    </div>
  );
}
