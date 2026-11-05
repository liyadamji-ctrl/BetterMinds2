import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { InterviewRoom } from "@/features/interview/components/InterviewRoom";
import type { InterviewQuestion, InterviewReport } from "@/features/interview/types";

export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const interview = await db.interviewSession.findUnique({ where: { id } });
  if (!interview || interview.userId !== session.userId) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">
        {interview.jobTitle}
        {interview.companyName ? ` at ${interview.companyName}` : ""}
      </h1>
      <AppErrorBoundary scope="interview">
        <InterviewRoom
          sessionId={interview.id}
          jobTitle={interview.jobTitle}
          initialQuestions={JSON.parse(interview.questionsJson) as InterviewQuestion[]}
          initialReport={interview.reportJson ? (JSON.parse(interview.reportJson) as InterviewReport) : null}
        />
      </AppErrorBoundary>
    </div>
  );
}
