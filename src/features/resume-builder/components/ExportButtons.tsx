"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ExportButtons({ resumeId }: { resumeId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadDocx() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/resumes/${resumeId}/export?type=docx`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "resume.docx";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* PDF export is just the browser's native print-to-PDF — no server
          round trip, no headless-browser dependency to host or pay for. */}
      <Button variant="secondary" onClick={() => window.print()}>
        Download PDF
      </Button>
      <Button variant="secondary" onClick={downloadDocx} disabled={downloading}>
        {downloading ? "Preparing…" : "Download Word"}
      </Button>
    </>
  );
}
