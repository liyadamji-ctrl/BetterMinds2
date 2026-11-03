import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Admin-side reads of the customer Resume Analyzer history (resume_analyses). */

export const PAGE_SIZE = 25;

export const SCORE_BANDS = ["all", "high", "mid", "low"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  all: "Any score",
  high: "75 and above",
  mid: "50 to 74",
  low: "Below 50",
};

export type AnalysisFilters = {
  q: string;
  band: ScoreBand;
  from: string;
  to: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** A valid YYYY-MM-DD or "". */
function cleanDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "";
}

export function parseFilters(params: RawParams): AnalysisFilters {
  const band = one(params.band);
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).trim().slice(0, 100),
    band: (SCORE_BANDS as readonly string[]).includes(band) ? (band as ScoreBand) : "all",
    from: cleanDate(one(params.from)),
    to: cleanDate(one(params.to)),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function bandWhere(band: ScoreBand): Prisma.ResumeAnalysisWhereInput {
  if (band === "high") return { matchScore: { gte: 75 } };
  if (band === "mid") return { matchScore: { gte: 50, lt: 75 } };
  if (band === "low") return { matchScore: { lt: 50 } };
  return {};
}

function buildWhere(f: AnalysisFilters): Prisma.ResumeAnalysisWhereInput {
  const and: Prisma.ResumeAnalysisWhereInput[] = [bandWhere(f.band)];
  if (f.q) {
    and.push({
      OR: [
        { jobTitle: { contains: f.q, mode: "insensitive" } },
        { fileName: { contains: f.q, mode: "insensitive" } },
        { user: { name: { contains: f.q, mode: "insensitive" } } },
        { user: { email: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
  if (f.to) and.push({ createdAt: { lt: new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000) } });
  return { AND: and };
}

export type AnalysisListRow = {
  id: string;
  userId: string;
  personName: string;
  personEmail: string;
  fileName: string | null;
  jobTitle: string;
  matchScore: number | null;
  createdAt: Date;
};

export type AnalysisOverview = {
  total: number;
  people: number;
  avgScore: number | null;
  below50: number;
};

export async function getAnalysisOverview(): Promise<AnalysisOverview> {
  const [total, people, avg, below50] = await Promise.all([
    db.resumeAnalysis.count(),
    db.resumeAnalysis.groupBy({ by: ["userId"] }).then((g) => g.length),
    db.resumeAnalysis.aggregate({ _avg: { matchScore: true } }),
    db.resumeAnalysis.count({ where: { matchScore: { lt: 50 } } }),
  ]);
  return {
    total,
    people,
    avgScore: avg._avg.matchScore === null ? null : Math.round(avg._avg.matchScore),
    below50,
  };
}

export async function getAnalysisList(filters: AnalysisFilters) {
  const where = buildWhere(filters);
  const [total, rows] = await Promise.all([
    db.resumeAnalysis.count({ where }),
    db.resumeAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // resumeText / resultJson are deliberately not selected: the list never
      // needs them and they are large.
      select: {
        id: true,
        userId: true,
        fileName: true,
        jobTitle: true,
        matchScore: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const list: AnalysisListRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    personName: r.user.name ?? r.user.email,
    personEmail: r.user.email,
    fileName: r.fileName,
    jobTitle: r.jobTitle,
    matchScore: r.matchScore,
    createdAt: r.createdAt,
  }));
  return { rows: list, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type PersonRow = {
  userId: string;
  name: string;
  email: string;
  analyses: number;
  distinctJobs: number;
  avgScore: number | null;
  lastAt: Date;
};

export async function getPeople(q: string, page: number) {
  const [byUserJob, profiles] = await Promise.all([
    db.resumeAnalysis.groupBy({
      by: ["userId", "jobTitle"],
      _count: { _all: true },
      _sum: { matchScore: true },
      _max: { createdAt: true },
    }),
    db.profile.findMany({
      where: { resumeAnalyses: { some: {} } },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const score = await db.resumeAnalysis.groupBy({
    by: ["userId"],
    where: { matchScore: { not: null } },
    _avg: { matchScore: true },
  });
  const avgByUser = new Map(score.map((s) => [s.userId, s._avg.matchScore]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const people = new Map<string, PersonRow>();
  for (const g of byUserJob) {
    const profile = profileById.get(g.userId);
    if (!profile) continue;
    const existing = people.get(g.userId);
    const lastAt = g._max.createdAt ?? new Date(0);
    if (existing) {
      existing.analyses += g._count._all;
      existing.distinctJobs += 1;
      if (lastAt > existing.lastAt) existing.lastAt = lastAt;
    } else {
      const avg = avgByUser.get(g.userId);
      people.set(g.userId, {
        userId: g.userId,
        name: profile.name ?? profile.email,
        email: profile.email,
        analyses: g._count._all,
        distinctJobs: 1,
        avgScore: avg === null || avg === undefined ? null : Math.round(avg),
        lastAt,
      });
    }
  }

  const needle = q.toLowerCase();
  const all = [...people.values()]
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

  return {
    rows: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: all.length,
    pages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)),
  };
}

export type PersonTimeline = {
  person: { id: string; name: string; email: string; role: string };
  analyses: Array<{
    id: string;
    fileName: string | null;
    jobTitle: string;
    matchScore: number | null;
    createdAt: Date;
  }>;
  /** Jobs this person analysed, most analyses first. */
  jobs: Array<{ jobTitle: string; count: number; bestScore: number | null }>;
};

export async function getPersonTimeline(userId: string): Promise<PersonTimeline | null> {
  const person = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!person) return null;

  const analyses = await db.resumeAnalysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, jobTitle: true, matchScore: true, createdAt: true },
  });

  const byJob = new Map<string, { count: number; best: number | null }>();
  for (const a of analyses) {
    const key = a.jobTitle.trim();
    const entry = byJob.get(key) ?? { count: 0, best: null };
    entry.count++;
    if (a.matchScore !== null && (entry.best === null || a.matchScore > entry.best)) entry.best = a.matchScore;
    byJob.set(key, entry);
  }

  return {
    person: { id: person.id, name: person.name ?? person.email, email: person.email, role: person.role },
    analyses,
    jobs: [...byJob.entries()]
      .map(([jobTitle, v]) => ({ jobTitle, count: v.count, bestScore: v.best }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getAnalysisDetail(id: string) {
  return db.resumeAnalysis.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, profileJson: true } } },
  });
}
