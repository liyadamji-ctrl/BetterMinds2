import type { FormattedResume } from "../lib/resumeDisplay";

/** Renders a redacted, sectioned resume for the admin analysis detail page. */
export function ResumeTextView({ resume }: { resume: FormattedResume }) {
  if (resume.sections.length === 0) {
    return <p className="text-sm text-ink-muted">No readable text was stored for this analysis.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-ts-md bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
        Name, email, phone, links and location are removed from the top of the resume
        {resume.redactions > 0 ? ` (${resume.redactions} items)` : ""}. This is best-effort, so personal details written
        in the body may remain.
      </p>

      {resume.sections.map((section, i) => (
        <section key={i} className="flex flex-col gap-2">
          {section.heading && (
            <h3 className="border-b border-line-strong pb-1 text-xs font-semibold uppercase tracking-wider text-forest">
              {section.heading}
            </h3>
          )}
          {section.blocks.map((block, j) =>
            block.type === "ul" ? (
              <ul key={j} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink marker:text-ink-muted">
                {block.items.map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            ) : section.heading === null && i === 0 ? (
              // The top of the resume: whatever headline is left once the
              // name and contact details have been taken out.
              <p key={j} className="text-base font-medium text-ink">
                {block.text}
              </p>
            ) : (
              <p key={j} className="text-sm leading-relaxed text-ink">
                {block.text}
              </p>
            )
          )}
        </section>
      ))}
    </div>
  );
}
