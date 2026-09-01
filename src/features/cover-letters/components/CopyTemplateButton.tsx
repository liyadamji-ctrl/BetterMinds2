"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyTemplateButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // template text is still fully visible on the page to select by hand.
    }
  }

  return (
    <Button variant="secondary" onClick={copy}>
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}
