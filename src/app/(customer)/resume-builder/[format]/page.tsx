import { notFound } from "next/navigation";
import { getResumeFormat } from "@/features/resume-builder/formats";
import { WizardForm } from "@/features/resume-builder/components/WizardForm";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export default async function WizardPage({ params }: { params: Promise<{ format: string }> }) {
  const { format: formatId } = await params;
  const format = getResumeFormat(formatId);
  if (!format) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-mw text-[32px] font-medium leading-[38px] tracking-[-0.01em] text-ink sm:text-[40px] sm:leading-[46px]">{format.name} resume</h1>
        <p className="mt-1 text-slate-600">Fill in what you have — you can edit everything after this too.</p>
      </div>
      <AppErrorBoundary scope="resume-builder:wizard">
        <WizardForm format={{ id: format.id, name: format.name, sections: format.sections }} />
      </AppErrorBoundary>
    </div>
  );
}
