import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Next.js hot-reloads modules in dev, which would otherwise create a fresh
 * PrismaClient (and a fresh DB connection) on every file save. Stashing the
 * instance on `globalThis` survives the reload and keeps one connection.
 *
 * DATABASE_URL should be Supabase's Transaction pooler connection string
 * (port 6543) — see supabase/README.md. Prisma 7 always connects through an
 * explicit driver adapter now; this is the Postgres one.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg(process.env.DATABASE_URL!);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
