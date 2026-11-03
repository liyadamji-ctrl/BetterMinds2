import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { InterviewSetup } from "@/features/interview/components/InterviewSetup";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const session = await requireUser();
  const { jobId } = await searchParams;

  const [resumes, jobRow] = await Promise.all([
    db.resume.findMany({
      where: { userId: session.userId },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    jobId
      ? db.job.findUnique({
          where: { id: jobId },
          include: { company: { select: { name: true, profileJson: true } } },
        })
      : Promise.resolve(null),
  ]);

  const companyData = jobRow?.company.profileJson
    ? (JSON.parse(jobRow.company.profileJson) as Record<string, string>)
    : null;
  const prefillJob = jobRow
    ? {
        jobId: jobRow.id,
        jobTitle: jobRow.title,
        companyName: companyData?.companyName ?? jobRow.company.name ?? "the company",
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ink sm:text-[40px] sm:leading-[46px]">New interview</h1>
        <p className="mt-1 text-sm text-slate-600">Tell us the role and we&rsquo;ll run a mock interview for it.</p>
      </div>
      <InterviewSetup resumes={resumes} prefillJob={prefillJob} invalidJobId={Boolean(jobId) && !jobRow} />
    </div>
  );
}
