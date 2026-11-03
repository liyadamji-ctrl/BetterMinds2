import "server-only";
import { db } from "@/lib/db";
import { FEATURES, type FeatureDef } from "./features";

export const RANGES = ["7", "30", "90", "all"] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | undefined): Range {
  return (RANGES as readonly string[]).includes(value ?? "") ? (value as Range) : "30";
}

export type FeatureUsageRow = {
  feature: FeatureDef;
  /** Events whose action counts as real use (see FeatureDef.useActions). */
  uses: number;
  /** Distinct users with at least one use. */
  uniqueUsers: number;
  /** Times the feature's page was opened. */
  opens: number;
  /** Uses in the previous period of the same length; null for "all time". */
  previousUses: number | null;
  /** Latest event of any kind, ever. */
  lastUsed: Date | null;
  /** Counts of the other actions seen in range, e.g. resume_exported. */
  otherActions: Array<{ action: string; count: number }>;
};

export type FeatureUsageReport = {
  range: Range;
  rows: FeatureUsageRow[];
  totalUses: number;
  activeUsers: number;
  generatedAt: Date;
};

type Group = { feature: string; action: string; userId: string | null; count: number };

async function loadGroups(from: Date | null, to: Date | null): Promise<Group[]> {
  const rows = await db.featureEvent.groupBy({
    by: ["feature", "action", "userId"],
    where: from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : undefined,
    _count: { _all: true },
  });
  return rows.map((r) => ({ feature: r.feature, action: r.action, userId: r.userId, count: r._count._all }));
}

function countUses(groups: Group[], def: FeatureDef): number {
  let n = 0;
  for (const g of groups) if (g.feature === def.id && def.useActions.includes(g.action)) n += g.count;
  return n;
}

export async function getFeatureUsage(range: Range): Promise<FeatureUsageReport> {
  const now = new Date();
  const days = range === "all" ? null : Number(range);
  const from = days ? new Date(now.getTime() - days * 86_400_000) : null;
  const prevFrom = days ? new Date(now.getTime() - 2 * days * 86_400_000) : null;

  const [current, previous, lastSeen] = await Promise.all([
    loadGroups(from, null),
    prevFrom && from ? loadGroups(prevFrom, from) : Promise.resolve(null),
    db.featureEvent.groupBy({ by: ["feature"], _max: { createdAt: true } }),
  ]);
  const lastByFeature = new Map(lastSeen.map((r) => [r.feature, r._max.createdAt]));

  const activeUsers = new Set<string>();
  for (const g of current) if (g.userId) activeUsers.add(g.userId);

  const rows: FeatureUsageRow[] = FEATURES.map((def) => {
    const mine = current.filter((g) => g.feature === def.id);
    const users = new Set<string>();
    let opens = 0;
    const others = new Map<string, number>();
    for (const g of mine) {
      if (def.useActions.includes(g.action) && g.userId) users.add(g.userId);
      if (g.action === "view") opens += g.count;
      else if (!def.useActions.includes(g.action)) others.set(g.action, (others.get(g.action) ?? 0) + g.count);
    }
    return {
      feature: def,
      uses: countUses(current, def),
      uniqueUsers: users.size,
      opens,
      previousUses: previous ? countUses(previous, def) : null,
      lastUsed: lastByFeature.get(def.id) ?? null,
      otherActions: [...others.entries()].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count),
    };
  }).sort((a, b) => b.uses - a.uses || b.uniqueUsers - a.uniqueUsers);

  return {
    range,
    rows,
    totalUses: rows.reduce((sum, r) => sum + r.uses, 0),
    activeUsers: activeUsers.size,
    generatedAt: now,
  };
}
