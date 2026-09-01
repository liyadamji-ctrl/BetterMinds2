import { requireUser } from "@/features/auth/lib/guard";
import { CopyTemplateButton } from "@/features/cover-letters/components/CopyTemplateButton";

const TEMPLATES = [
  {
    title: "Sending your application",
    subject: "Application for [Position] — [Your Name]",
    body: `Dear [Hiring Manager],

I'm writing to apply for the [Position] role at [Company]. I've attached my resume and cover letter for your review.

[One or two sentences on why you're a strong fit.]

Thank you for your time and consideration — I look forward to hearing from you.

Best regards,
[Your Name]`,
  },
  {
    title: "Following up after applying",
    subject: "Following up on my application for [Position]",
    body: `Dear [Hiring Manager],

I applied for the [Position] role at [Company] on [date] and wanted to follow up to confirm my application was received and reiterate my interest.

I'd welcome the chance to discuss how my background in [relevant skill/experience] could contribute to your team.

Thank you again for your consideration.

Best regards,
[Your Name]`,
  },
  {
    title: "Following up after an interview",
    subject: "Following up on our interview for [Position]",
    body: `Dear [Interviewer's Name],

Thank you again for taking the time to speak with me about the [Position] role on [date]. I wanted to follow up and see if there's any update on next steps, or if there's any additional information I can provide.

I remain very interested in the opportunity and enjoyed learning more about [something specific from the interview].

Best regards,
[Your Name]`,
  },
  {
    title: "Reaching out to a recruiter",
    subject: "Interested in opportunities at [Company]",
    body: `Hi [Recruiter's Name],

My name is [Your Name], and I'm reaching out because I'm very interested in [Position / opportunities at Company]. I have experience in [relevant skill/field] and believe my background would be a strong match.

I've attached my resume for your review — I'd love the chance to connect and learn more about current openings.

Thank you for your time,
[Your Name]`,
  },
  {
    title: "Thank-you after an interview",
    subject: "Thank you — [Position] interview",
    body: `Dear [Interviewer's Name],

Thank you for taking the time to meet with me today about the [Position] role. I really enjoyed our conversation about [something specific], and it confirmed how excited I am about the opportunity to join [Company].

Please let me know if there's anything else I can provide as you move forward in the process.

Best regards,
[Your Name]`,
  },
];

export default async function EmailTemplatesPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email templates</h1>
        <p className="mt-1 text-slate-600">
          Copy one of these and fill in the bracketed details — use them alongside your cover letters.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {TEMPLATES.map((template) => (
          <div key={template.title} className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">{template.title}</h2>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Subject: {template.subject}</p>
              </div>
              <CopyTemplateButton text={`Subject: ${template.subject}\n\n${template.body}`} />
            </div>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-slate-700">{template.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
