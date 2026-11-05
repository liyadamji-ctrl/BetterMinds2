import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { CoverLetterList, type CoverLetterRow } from "@/features/cover-letters/components/CoverLetterList";

export default async function CoverLettersPage() {
  const session = await requireUser();

  const rows = await db.coverLetter.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, companyName: true, jobTitle: true, createdAt: true },
  });

  const coverLetters: CoverLetterRow[] = rows.map((row) => ({
    id: row.id,
    companyName: row.companyName,
    jobTitle: row.jobTitle,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Cover Letters</h1>
        <div className="flex items-center gap-3">
          <Link href="/email-templates">
            <Button variant="secondary">Email Templates</Button>
          </Link>
          <Link href="/cover-letters/new">
            <Button>New Cover Letter</Button>
          </Link>
        </div>
      </div>
      <CoverLetterList initialCoverLetters={coverLetters} />
    </div>
  );
}
