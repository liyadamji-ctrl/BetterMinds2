"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export function AdminNav() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/admin">
            <Logo variant="dark" suffix="Admin" />
          </Link>
          <Link href="/admin/sessions" className="text-sm text-slate-400 hover:text-white">
            Session Recordings
          </Link>
        </div>
        <Button variant="ghost" className="text-slate-300 hover:bg-slate-800 hover:text-white" onClick={logout}>
          Log out
        </Button>
      </div>
    </nav>
  );
}
