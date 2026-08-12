import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route guard. Blocks unauthenticated requests to protected areas before
 * any page renders — this is what keeps customer, company, and admin routes
 * isolated at the network level, not just hidden in the UI.
 *
 * Note: this only checks "is someone logged in", not their specific role.
 * Supabase's session client works on the Edge runtime, but Prisma (used to
 * look up a profile's role) does not — so role-specific checks happen in
 * each layout via requireAdmin() / requireCompany() / requireCustomer(),
 * which run in the Node.js runtime. Still enforced server-side before any
 * page content is generated.
 */
export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/resume-builder") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/onboarding");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/resume-builder/:path*",
    "/company/:path*",
    "/onboarding/:path*",
  ],
};
