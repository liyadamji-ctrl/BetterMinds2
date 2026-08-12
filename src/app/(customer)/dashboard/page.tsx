import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";

export default async function DashboardPage() {
  const session = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your resumes</h1>
        <Link href="/resume-builder">
          <Button>Build a new resume</Button>
        </Link>
      </div>

      {resumes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">You haven&rsquo;t built a resume yet.</p>
          <Link href="/resume-builder" className="mt-3 inline-block">
            <Button>Get started</Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {resumes.map((resume) => (
            <li key={resume.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-slate-900">{resume.title}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {resume.format} · {resume.status} · updated{" "}
                  {resume.updatedAt.toLocaleDateString()}
                </p>
              </div>
              <Link href={`/resume-builder/edit/${resume.id}`}>
                <Button variant="secondary">Open</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
