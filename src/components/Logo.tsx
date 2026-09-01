type LogoProps = {
  /** "dark" renders the wordmark in white, for dark nav backgrounds (e.g. AdminNav). */
  variant?: "default" | "dark";
  /** Extra text after the wordmark, e.g. "Admin". */
  suffix?: string;
};

/**
 * The single place the brand mark is rendered. When the final 3D SVG logo
 * asset is ready, swap the placeholder <span> mark below for it — every
 * call site (nav bars, auth pages, landing page) picks up the change
 * automatically.
 */
export function Logo({ variant = "default", suffix }: LogoProps) {
  const textColor = variant === "dark" ? "text-white" : "text-indigo-700";

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${textColor}`}>
      <span aria-hidden className="inline-block h-5 w-5 rounded bg-indigo-700" />
      ResumeRiseAI{suffix ? ` ${suffix}` : ""}
    </span>
  );
}
