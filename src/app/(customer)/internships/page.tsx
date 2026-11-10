import { requireUser } from "@/features/auth/lib/guard";
import { DiscoverySearch } from "@/features/discovery/components/DiscoverySearch";
import { db } from "@/lib/db";
import { loadSavedSearches } from "@/features/discovery/lib/savedSearches";

export default async function InternshipsPage() {
  const session = await requireUser();
  const searches = await loadSavedSearches(session.userId, "INTERNSHIP");
  const resumes = await db.resume.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Internships</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick a resume and we will suggest the internships that fit your experience and skills, or search a job title and field yourself. You get links to openings on top job boards.
        </p>
      </div>
      <DiscoverySearch kind="INTERNSHIP" initialSearches={searches} resumes={resumes} />
    </div>
  );
}
