import "server-only";
import { db } from "@/lib/db";
import { readRecommendation, summarizeScreening, type ScreeningSummary } from "./aiEffectiveness";

export type CompanyRow = {
  id: string;
  name: string;
  email: string;
  joinedAt: Date;
  jobs: number;
  openJobs: number;
  ai: ScreeningSummary;
};

export type CompanyJobRow = {
  id: string;
  title: string;
  status: string;
  employmentType: string;
  createdAt: Date;
  ai: ScreeningSummary;
};

export type CompanyDetail = {
  company: { id: string; name: string; email: string; joinedAt: Date; industry: string | null; location: string | null };
  overall: ScreeningSummary;
  jobs: CompanyJobRow[];
};

function companyDisplayName(profile: { name: string | null; email: string; profileJson: string | null }) {
  let data: Record<string, string> | null = null;
  try {
    data = profile.profileJson ? (JSON.parse(profile.profileJson) as Record<string, string>) : null;
  } catch {
    data = null;
  }
  return {
    name: data?.companyName || profile.name || profile.email,
    industry: data?.industry || null,
    location: data?.location || null,
  };
}

const APPLICATION_SELECT = { status: true, matchScore: true, screeningJson: true } as const;

type AppRow = { status: string; matchScore: number | null; screeningJson: string | null };

function toInputs(apps: AppRow[]) {
  return apps.map((a) => ({
    status: a.status,
    matchScore: a.matchScore,
    recommendation: readRecommendation(a.screeningJson, a.matchScore),
  }));
}

/** Every company with its job counts and AI-screening results. */
export async function getCompanies(): Promise<CompanyRow[]> {
  const companies = await db.profile.findMany({
    where: { role: "COMPANY" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      profileJson: true,
      createdAt: true,
      jobsPosted: {
        select: { status: true, applications: { select: APPLICATION_SELECT } },
      },
    },
  });

  return companies.map((c) => ({
    id: c.id,
    name: companyDisplayName(c).name,
    email: c.email,
    joinedAt: c.createdAt,
    jobs: c.jobsPosted.length,
    openJobs: c.jobsPosted.filter((j) => j.status === "OPEN").length,
    ai: summarizeScreening(toInputs(c.jobsPosted.flatMap((j) => j.applications))),
  }));
}

export async function getCompanyDetail(id: string): Promise<CompanyDetail | null> {
  const company = await db.profile.findFirst({
    where: { id, role: "COMPANY" },
    select: {
      id: true,
      name: true,
      email: true,
      profileJson: true,
      createdAt: true,
      jobsPosted: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          employmentType: true,
          createdAt: true,
          applications: { select: APPLICATION_SELECT },
        },
      },
    },
  });
  if (!company) return null;

  const display = companyDisplayName(company);
  return {
    company: {
      id: company.id,
      name: display.name,
      email: company.email,
      joinedAt: company.createdAt,
      industry: display.industry,
      location: display.location,
    },
    overall: summarizeScreening(toInputs(company.jobsPosted.flatMap((j) => j.applications))),
    jobs: company.jobsPosted.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      employmentType: j.employmentType,
      createdAt: j.createdAt,
      ai: summarizeScreening(toInputs(j.applications)),
    })),
  };
}
