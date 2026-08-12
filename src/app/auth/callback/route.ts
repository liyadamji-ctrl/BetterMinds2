import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/lib/guard";
import { db } from "@/lib/db";

/**
 * Where Google (and email-confirmation link) sign-ins land after Supabase
 * finishes the OAuth/magic-link handshake. Exchanges the one-time `code` for
 * a real session, then routes the browser based on the user's role and
 * whether they still need to complete onboarding.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const session = await getSession();
      if (!session) return NextResponse.redirect(`${origin}/login`);

      const profile = await db.profile.findUnique({
        where: { id: session.userId },
        select: { needsOnboarding: true, role: true },
      });

      // If the signup form stored an account-type choice in a short-lived
      // cookie (set just before the Google OAuth redirect), apply it now.
      const cookieStore = await cookies();
      const signupType = cookieStore.get("signup_account_type")?.value;
      let effectiveRole = profile?.role ?? "CUSTOMER";

      if (signupType && profile?.needsOnboarding && effectiveRole !== "ADMIN") {
        const chosenRole = signupType === "employer" ? "COMPANY" : "CUSTOMER";
        if (chosenRole !== effectiveRole) {
          await db.profile.update({
            where: { id: session.userId },
            data: { role: chosenRole },
          });
          effectiveRole = chosenRole;
        }
      }

      // Send new users (needs_onboarding=true) to the profile setup wizard.
      if (profile?.needsOnboarding) {
        const response = NextResponse.redirect(`${origin}/onboarding`);
        response.cookies.delete("signup_account_type");
        return response;
      }

      // Returning users — route by role.
      const dest =
        effectiveRole === "ADMIN"
          ? "/admin"
          : effectiveRole === "COMPANY"
            ? "/company"
            : "/dashboard";

      const response = NextResponse.redirect(`${origin}${dest}`);
      response.cookies.delete("signup_account_type");
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
