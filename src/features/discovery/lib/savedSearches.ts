import "server-only";
import { db } from "@/lib/db";
import type { Kind, SavedSearch } from "../components/DiscoverySearch";

export async function loadSavedSearches(userId: string, kind: Kind): Promise<SavedSearch[]> {
  const rows = await db.discoverySearch.findMany({
    where: { userId, kind },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => {
    const filters = JSON.parse(row.filtersJson) as Partial<SavedSearch>;
    return {
      id: row.id,
      query: row.query,
      area: filters.area ?? "",
      location: filters.location ?? "",
      level: filters.level ?? "",
      freeOnly: filters.freeOnly ?? false,
      remote: filters.remote ?? false,
      jobType: filters.jobType ?? "internship",
      skills: filters.skills ?? [],
      experience: filters.experience ?? "",
      keywords: JSON.parse(row.keywordsJson) as string[],
      createdAt: row.createdAt.toISOString(),
    };
  });
}
