import { CvToResume } from "@/features/cv-to-resume/components/CvToResume";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export default function FromCvPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ocean sm:text-[40px] sm:leading-[46px]">Turn your CV into a resume</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload your CV and we&rsquo;ll show what to keep and what to cut, then build a resume from it in the template you choose.
        </p>
      </div>
      <AppErrorBoundary scope="cv-to-resume">
        <CvToResume />
      </AppErrorBoundary>
    </div>
  );
}
