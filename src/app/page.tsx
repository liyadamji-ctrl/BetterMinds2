import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <h1 className="text-4xl font-bold text-slate-900">
          Your career starts here.
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Build a resume, land internships, and ace your interviews — or post jobs and
          find the best candidates with AI-assisted resume screening.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/signup">
          <Button>Get started — it&rsquo;s free</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6 text-left">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-lg font-semibold text-slate-900">For Job Seekers</p>
          <p className="mt-1 text-sm text-slate-500">
            Upload or build your resume, get AI feedback, and apply to internships posted
            directly on ResumeRiseAI.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-lg font-semibold text-slate-900">For Employers</p>
          <p className="mt-1 text-sm text-slate-500">
            Post openings, browse applicants, and use AI to shortlist the best resumes
            in seconds.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-lg font-semibold text-slate-900">Interview Prep</p>
          <p className="mt-1 text-sm text-slate-500">
            Practice with role-specific mock interviews and get scored feedback to improve
            before the real thing.
          </p>
        </div>
      </div>
    </main>
  );
}
