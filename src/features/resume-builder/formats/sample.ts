import type { ResumeAnswers } from "./types";

/** Made-up answers used to draw each template's preview on the format picker. */
export const sampleAnswers: ResumeAnswers = {
  personal: {
    fullName: "Alex Morgan",
    email: "alex.morgan@email.com",
    phone: "(555) 010-2345",
    location: "Atlanta, GA",
    linkedin: "linkedin.com/in/alexmorgan",
  },
  summary: {
    summary:
      "Motivated student with leadership experience in business clubs and a strong interest in marketing and analytics.",
  },
  experience: [
    {
      role: "Marketing Intern",
      company: "Northwind Studio",
      dates: "Jun 2025 – Aug 2025",
      description:
        "Grew the studio's newsletter list by 18% with a new sign-up campaign\nPresented weekly analytics to a team of five",
    },
    {
      role: "Vice President",
      company: "Future Business Leaders Club",
      dates: "Sep 2024 – Present",
      description: "Led a 40-member chapter to two state awards\nPlanned monthly workshops and events",
    },
  ],
  education: [{ school: "Atlanta International School", degree: "High School Diploma", dates: "2022 – 2026" }],
  skills: { skills: "Excel, Canva, Public speaking, SQL, Spanish" },
};
