import Link from "next/link";
import { resumeFormats } from "@/features/resume-builder/formats";

export default function ChooseFormatPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Choose a format</h1>
        <p className="mt-1 text-slate-600">Every format asks the same questions — pick the look you want.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {resumeFormats.map((format) => (
          <Link
            key={format.id}
            href={`/resume-builder/${format.id}`}
            className="rounded-lg border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{format.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{format.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
