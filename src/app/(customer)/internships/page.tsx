import { requireUser } from "@/features/auth/lib/guard";
import { DiscoverySearch } from "@/features/discovery/components/DiscoverySearch";
import { loadSavedSearches } from "@/features/discovery/lib/savedSearches";

export default async function InternshipsPage() {
  const session = await requireUser();
  const searches = await loadSavedSearches(session.userId, "INTERNSHIP");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Internships</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search a role and field to get links to openings on top job boards, then apply to any of them.
        </p>
      </div>
      <DiscoverySearch kind="INTERNSHIP" initialSearches={searches} />
    </div>
  );
}
