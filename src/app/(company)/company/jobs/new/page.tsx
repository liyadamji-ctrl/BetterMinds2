import Link from "next/link";
import { requireCompany } from "@/features/auth/lib/guard";

export default async function NewJobPage() {
  await requireCompany();

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="rounded-full bg-sky-500/10 p-5">
        <svg
          className="h-10 w-10 text-sky-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">Post a Job</h1>
        <p className="mt-2 max-w-md text-slate-400">
          This is one of the features you&rsquo;ll build. Create a form here that lets
          employers write a job title, description, location, and requirements, then
          save the posting so job seekers can find and apply to it.
        </p>
      </div>
      <Link
        href="/company/jobs"
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
      >
        Back to jobs
      </Link>
    </div>
  );
}
