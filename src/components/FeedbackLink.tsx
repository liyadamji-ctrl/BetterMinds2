import { MessageSquare } from "lucide-react";

/**
 * Link to the tester feedback form (a Google Form). The address comes from
 * NEXT_PUBLIC_FEEDBACK_FORM_URL so it can be changed without touching code;
 * when it is not set nothing is rendered.
 */
const FEEDBACK_FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL;

export function FeedbackLink({
  className = "",
  iconSize = 16,
  withIcon = true,
}: {
  className?: string;
  iconSize?: number;
  withIcon?: boolean;
}) {
  if (!FEEDBACK_FORM_URL) return null;
  return (
    <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {withIcon && <MessageSquare size={iconSize} aria-hidden />}
      Give Feedback
    </a>
  );
}
