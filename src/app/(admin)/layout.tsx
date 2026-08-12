import { requireAdmin } from "@/features/auth/lib/guard";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Also enforced in middleware.ts — this is the belt-and-suspenders check
  // that runs even if a page is ever reached a different way.
  await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminNav />
      <AppErrorBoundary scope="admin">
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </AppErrorBoundary>
    </div>
  );
}
