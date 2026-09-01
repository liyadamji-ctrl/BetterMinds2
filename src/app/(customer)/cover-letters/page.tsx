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
        <h1 className="text-2xl font-bold text-slate-900">Cover letters</h1>
        <div className="flex items-center gap-3">
          <Link href="/email-templates">
            <Button variant="secondary">Email templates</Button>
          </Link>
          <Link href="/cover-letters/new">
            <Button>New cover letter</Button>
          </Link>
        </div>
      </div>
      <CoverLetterList initialCoverLetters={coverLetters} />
    </div>
  );
}
