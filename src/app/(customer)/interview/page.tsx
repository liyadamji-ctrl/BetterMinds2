import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { InterviewHistory, type InterviewRow } from "@/features/interview/components/InterviewHistory";
import type { InterviewQuestion } from "@/features/interview/types";

export default async function InterviewPage() {
  const session = await requireUser();

  const sessions = await db.interviewSession.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  const rows: InterviewRow[] = sessions.map((s) => {
    const questions = JSON.parse(s.questionsJson) as InterviewQuestion[];
    return {
      id: s.id,
      jobTitle: s.jobTitle,
      companyName: s.companyName,
      status: s.status,
      overallScore: s.overallScore,
      answered: questions.filter((q) => q.analysis).length,
      total: questions.length,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Interview Simulator</h1>
          <p className="mt-1 text-sm text-slate-600">
            Practice a realistic interview for your target job and get a score with specific feedback to improve.
          </p>
        </div>
        <Link href="/interview/new">
          <Button>New Interview</Button>
        </Link>
      </div>
      <InterviewHistory initialRows={rows} />
    </div>
  );
}
