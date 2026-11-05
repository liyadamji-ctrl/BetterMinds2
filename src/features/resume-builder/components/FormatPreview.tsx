import type { ResumeFormat } from "../formats/types";
import { sampleAnswers } from "../formats/sample";

const PAGE_WIDTH = 816; // a US Letter page at 96 dpi
const SCALE = 1 / 3;

/**
 * A miniature of what a format looks like, drawn from sample answers. The
 * HTML comes from the format's own render() with made-up data, so it is safe
 * to inject. Purely visual: hidden from screen readers and not clickable.
 */
export function FormatPreview({ format }: { format: ResumeFormat }) {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[300px] w-[272px] max-w-full overflow-hidden rounded-mw-md border border-line bg-[#ffffff] shadow-mw-card"
    >
      <div
        className="pointer-events-none origin-top-left select-none bg-[#ffffff] p-10 text-[#111827]"
        style={{ width: PAGE_WIDTH, transform: `scale(${SCALE})` }}
        dangerouslySetInnerHTML={{ __html: format.render(sampleAnswers) }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#ffffff] to-transparent" />
    </div>
  );
}
