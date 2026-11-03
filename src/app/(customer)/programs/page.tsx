import { requireUser } from "@/features/auth/lib/guard";
import { DiscoverySearch } from "@/features/discovery/components/DiscoverySearch";
import { loadSavedSearches } from "@/features/discovery/lib/savedSearches";

export default async function ProgramsPage() {
  const session = await requireUser();
  const searches = await loadSavedSearches(session.userId, "PROGRAM");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ink sm:text-[40px] sm:leading-[46px]">Programs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick a topic to get links to course listings on top learning sites, then enroll in any of them.
        </p>
      </div>
      <DiscoverySearch kind="PROGRAM" initialSearches={searches} />
    </div>
  );
}
