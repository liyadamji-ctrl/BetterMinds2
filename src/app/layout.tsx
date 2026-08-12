import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focal — Career Platform",
  description:
    "Build your resume, find internships, prep for interviews, and connect with employers — all in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
