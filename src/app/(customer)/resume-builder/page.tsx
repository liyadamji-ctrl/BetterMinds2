import Link from "next/link";
import { resumeFormats } from "@/features/resume-builder/formats";

export default function ChooseFormatPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Choose a format</h1>
        <p className="mt-1 text-slate-600">Every format asks the same questions — pick the look you want.</p>
      </div>
      <Link
        href="/resume-builder/from-cv"
        className="rounded-mw-lg border border-indigo-200 bg-indigo-50 p-5 transition-shadow hover:shadow-md"
      >
        <h2 className="font-semibold text-slate-900">Already have a CV? Turn it into a resume</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload it and we&rsquo;ll pick out what to keep, what to cut, and fill a template for you.
        </p>
      </Link>
      <div className="grid gap-4 sm:grid-cols-2">
        {resumeFormats.map((format) => (
          <Link
            key={format.id}
            href={`/resume-builder/${format.id}`}
            className="rounded-mw-lg bg-surface-raised shadow-mw-card p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{format.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{format.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
