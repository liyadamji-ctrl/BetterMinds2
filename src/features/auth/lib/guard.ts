import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export type Session = {
  userId: string;
  email: string;
  name: string | null;
  role: "CUSTOMER" | "COMPANY" | "ADMIN";
};

/** Reads the Supabase session and joins it to the matching Profile row. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await db.profile.findUnique({ where: { id: user.id } });
  // Should only happen in the instant between auth.users being created and
  // the trigger finishing — treat it as "not logged in yet" rather than crash.
  if (!profile) return null;

  return {
    userId: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Session["role"],
  };
}

/** For Server Components/pages: bounce to /login if there's no session. */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For customer-only pages: bounces non-customers and guests away. */
export async function requireCustomer(): Promise<Session> {
  const session = await requireUser();
  if (session.role === "ADMIN") redirect("/admin");
  if (session.role === "COMPANY") redirect("/company");
  return session;
}

/** For company-only pages: bounces non-companies and guests away. */
export async function requireCompany(): Promise<Session> {
  const session = await requireUser();
  if (session.role !== "COMPANY") redirect("/dashboard");
  return session;
}

/** For admin-only Server Components/pages: bounce non-admins to /dashboard. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.role !== "ADMIN") redirect("/dashboard");
  return session;
}
