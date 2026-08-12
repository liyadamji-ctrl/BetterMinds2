"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function CompanyNav() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/company" className="font-semibold text-indigo-700">
            Focal
          </Link>
          <Link href="/company/jobs" className="text-sm text-slate-600 hover:text-slate-900">
            Job Postings
          </Link>
        </div>
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </div>
    </nav>
  );
}
