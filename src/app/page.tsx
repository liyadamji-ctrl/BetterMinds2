import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Clock,
  FileText,
  FileSearch,
  Mail,
  MapPin,
  Mic,
  Search,
  Sprout,
  Users,
} from "lucide-react";
import { MeadowScope } from "@/components/meadow/MeadowScope";
import { MwBadge, MwLink, ThemeToggle, Wordmark } from "@/components/meadow/ui";

const FEATURES = [
  {
    icon: FileText,
    title: "Resume builder",
    body: "Pick a format and answer a few questions, or upload your CV and we turn it into a clean resume you can edit and export.",
    wide: true,
  },
  {
    icon: FileSearch,
    title: "Resume analyzer",
    body: "Paste a job description and see how your resume matches it, with specific things to fix.",
  },
  {
    icon: Mail,
    title: "Cover letters",
    body: "Get a first draft written for the role. Edit it until it sounds like you.",
  },
  {
    icon: Briefcase,
    title: "Jobs and internships",
    body: "Apply to roles posted on Prepped, and find more openings on the top job boards.",
  },
  {
    icon: Users,
    title: "Programs",
    body: "Search programs in your field and keep the ones you like.",
  },
];

const STEPS = [
  { title: "Build your resume", body: "Start from scratch or bring your CV. It takes a few minutes." },
  { title: "Practise and polish", body: "Check it against a job, write a cover letter and run a mock interview." },
  { title: "Apply with confidence", body: "Apply to roles and follow each application in one place." },
];

export default function HomePage() {
  return (
    <MeadowScope>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-mw-md focus:bg-surface-raised focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Wordmark />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {[
              ["#features", "What you get"],
              ["#how", "How it works"],
              ["#employers", "For employers"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-mw-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <MwLink href="/login" variant="ghost" size="sm">
              Log in
            </MwLink>
            <MwLink href="/signup" variant="primary" size="sm" className="max-[380px]:hidden">
              Get started
            </MwLink>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-20">
          <div>
            <h1 className="font-serif-mw text-[44px] font-medium leading-[48px] tracking-[-0.02em] text-ocean sm:text-[56px] sm:leading-[60px]">
              Find your first step.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-[26px] text-ink-muted">
              Build a resume, practise your interviews and apply to internships, all in one calm place. Job hunting is
              stressful. We keep it to one next step at a time.
            </p>

            <form
              action="/jobs"
              method="get"
              role="search"
              className="mt-8 flex max-w-xl flex-col gap-2 rounded-mw-lg bg-surface-raised p-2 shadow-mw-card focus-within:ring-2 focus-within:ring-focus sm:flex-row sm:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-3 px-4 text-ink-subtle">
                <Search size={20} aria-hidden />
                <span className="sr-only">Search jobs and internships</span>
                <input
                  name="q"
                  type="search"
                  placeholder="Role or field, like design or data"
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-mw-md bg-brand px-6 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
              >
                Search roles
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <MwLink href="/signup" variant="primary" size="lg">
                Create a free account
              </MwLink>
              <MwLink href="/login" variant="secondary" size="lg">
                Log in
              </MwLink>
            </div>
          </div>

          {/* Example of what students see inside the app */}
          <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-mw-xl bg-brand-soft p-5 sm:p-8">
              <div className="rounded-mw-lg bg-surface-raised p-5 shadow-mw-card">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 flex-none place-items-center rounded-mw-md bg-brand-soft font-serif-mw text-xl text-brand">
                    N
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[18px] font-semibold leading-6 text-ink">Product Design Intern</p>
                    <p className="text-[15px] text-ink-muted">Northwind Studio</p>
                  </div>
                  <MwBadge tone="seafoam">New</MwBadge>
                </div>
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted">
                  <li className="inline-flex items-center gap-1.5">
                    <MapPin size={16} /> Remote
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <Clock size={16} /> 12 weeks
                  </li>
                  <li className="font-semibold text-ink">$28/hr</li>
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-ink-muted">
                  <span>Posted 2 days ago</span>
                  <span className="font-semibold text-warning">5 days left</span>
                </div>
              </div>

              <div className="mt-4 rounded-mw-lg bg-surface-raised p-5 shadow-mw-card">
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-semibold text-ink">Your profile</p>
                  <p className="font-serif-mw text-[32px] font-medium leading-none text-ocean">72</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full w-[72%] rounded-full bg-teal" />
                </div>
                <p className="mt-3 text-sm text-ink-muted">Keep going. Add a project to stand out.</p>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-ink-muted">Example role and profile</p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-line bg-surface-sunken/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="max-w-[20ch] font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">
              Everything for your first role
            </h2>
            <p className="mt-3 max-w-[56ch] text-[17px] leading-[26px] text-ink-muted">
              Each tool does one job. Use the ones you need, in any order.
            </p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body, wide }) => (
                <li
                  key={title}
                  className={`rounded-mw-lg p-6 shadow-mw-card transition-shadow hover:shadow-mw-float ${
                    wide
                      ? "bg-brand text-on-brand sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:flex lg:flex-col lg:justify-between lg:p-8"
                      : "bg-surface-raised"
                  }`}
                >
                  <Icon size={28} strokeWidth={1.6} aria-hidden className={wide ? "" : "text-brand"} />
                  <div className={wide ? "mt-6" : "mt-4"}>
                    <h3
                      className={`${
                        wide ? "font-serif-mw text-[28px] leading-[34px]" : "text-[18px] font-semibold leading-6"
                      } ${wide ? "" : "text-ocean"}`}
                    >
                      {title}
                    </h3>
                    <p className={`mt-2 text-[15px] leading-[22px] ${wide ? "opacity-90" : "text-ink-muted"}`}>{body}</p>
                  </div>
                </li>
              ))}

              {/* Interview practice: the one sky-blue moment on the page */}
              <li className="rounded-mw-lg bg-sky p-6 text-ink shadow-mw-card sm:col-span-2 lg:col-span-3 lg:flex lg:items-center lg:gap-8 lg:p-8">
                <Mic size={28} strokeWidth={1.6} aria-hidden className="flex-none" />
                <div className="mt-4 lg:mt-0">
                  <h3 className="font-serif-mw text-[28px] leading-[34px]">Interview practice</h3>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-[22px]">
                    Run a mock interview for the role you want and get scored feedback. Do it as many times as you
                    like before the real one.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* How it works: a real sequence, so numbered */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">
            How it works
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 md:flex-col">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-seafoam text-[15px] font-semibold text-on-seafoam">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[18px] font-semibold leading-6 text-ink">{step.title}</h3>
                  <p className="mt-1 max-w-[34ch] text-[15px] leading-[22px] text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Employers: a quieter path */}
        <section id="employers" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6 lg:pb-20">
          <div className="grid gap-6 rounded-mw-xl bg-brand-soft p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-brand">
                <Sprout size={20} aria-hidden />
                <span className="text-sm font-semibold">For employers</span>
              </div>
              <h2 className="mt-3 max-w-[24ch] font-serif-mw text-[28px] font-medium leading-[34px] text-ocean sm:text-[32px] sm:leading-[38px]">
                Hiring? Shortlist resumes in minutes.
              </h2>
              <p className="mt-2 max-w-[56ch] text-[15px] leading-[22px] text-ink-muted">
                Post an opening, review applicants and let AI score each resume against your job. You decide who moves
                forward.
              </p>
            </div>
            <MwLink href="/signup" variant="secondary" size="lg" className="justify-self-start md:justify-self-end">
              Post a job <ArrowRight size={18} aria-hidden />
            </MwLink>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="max-w-[18ch] font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">
                Ready for your first step?
              </h2>
              <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-muted">
                <BadgeCheck size={18} className="text-brand" aria-hidden /> Free to start. No card needed.
              </p>
            </div>
            <MwLink href="/signup" variant="primary" size="lg">
              Create a free account
            </MwLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark className="!text-[20px]" />
          <p>&copy; {new Date().getFullYear()} Prepped</p>
          <nav aria-label="Account" className="flex gap-4">
            <Link href="/login" className="hover:text-ink">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </MeadowScope>
  );
}
