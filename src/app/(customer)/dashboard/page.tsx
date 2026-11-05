import Link from "next/link";
import { requireUser } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";
import { MwBadge, MwLink, PageTitle } from "@/components/meadow/ui";
import { MwEmpty, Monogram } from "@/components/meadow/blocks";

export default async function DashboardPage() {
  const session = await requireUser();
  const [profile, resumes] = await Promise.all([
    db.profile.findUnique({ where: { id: session.userId }, select: { name: true } }),
    db.resume.findMany({ where: { userId: session.userId }, orderBy: { updatedAt: "desc" } }),
  ]);
  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-8">
      <PageTitle
        title={firstName ? `Hi, ${firstName}` : "Your resumes"}
        description={
          resumes.length === 0
            ? "Start with a resume. It only takes a few minutes."
            : "Pick up where you left off, or start something new."
        }
        actions={
          <>
            <MwLink href="/resume-analyzer" variant="secondary">
              Analyze a resume
            </MwLink>
            <MwLink href="/resume-builder" variant="primary">
              Build a new resume
            </MwLink>
          </>
        }
      />

      <section aria-labelledby="resumes-heading" className="flex flex-col gap-4">
        <h2 id="resumes-heading" className="font-serif-mw text-[28px] font-medium leading-[34px] text-ocean">
          Your resumes
        </h2>
        {resumes.length === 0 ? (
          <MwEmpty
            title="No resumes yet"
            description="Build one from scratch or upload your CV and we will turn it into a resume."
            action={
              <MwLink href="/resume-builder" variant="primary">
                Build a resume
              </MwLink>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <Link
                  href={`/resume-builder/edit/${resume.id}`}
                  className="flex h-full flex-col gap-4 rounded-mw-lg bg-surface-raised p-5 shadow-mw-card transition-shadow hover:shadow-mw-float sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    <Monogram name={resume.title} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[18px] font-semibold leading-6 text-ink">{resume.title}</p>
                      <p className="mt-0.5 text-sm capitalize text-ink-muted">{resume.format.toLowerCase()}</p>
                    </div>
                    <MwBadge tone={resume.status === "DRAFT" ? "neutral" : "brand"}>
                      {resume.status.charAt(0) + resume.status.slice(1).toLowerCase()}
                    </MwBadge>
                  </div>
                  <p className="mt-auto border-t border-line pt-4 text-xs text-ink-muted">
                    Updated {resume.updatedAt.toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
