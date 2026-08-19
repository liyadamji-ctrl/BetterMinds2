/**
 * Turns an uploaded resume file into plain text, entirely in the browser.
 * The raw file never leaves the client — only this extracted text is sent
 * to the server. pdfjs-dist and mammoth are both dynamically imported so
 * they never end up in a server bundle (this module is only ever called
 * from a "use client" component).
 */

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That file is too large — please upload something under 8MB.");
  }

  const name = file.name.toLowerCase();
  let text: string;

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractFromPdf(file);
  } else if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    text = await extractFromDocx(file);
  } else if (name.endsWith(".txt") || file.type === "text/plain") {
    text = await file.text();
  } else {
    throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT resume.");
  }

  const trimmed = text.trim();
  if (trimmed.length < 30) {
    throw new Error("Couldn't find enough readable text in that file. Try a different export of your resume.");
  }
  return trimmed;
}

async function extractFromPdf(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // Pointing at `new URL("pdfjs-dist/...", import.meta.url)` makes Next's
    // webpack build pull the worker into its own bundle, where Terser then
    // fails on `import.meta` inside it. Serving the exact same file as a
    // static asset from /public sidesteps that entirely. It's copied from
    // node_modules/pdfjs-dist/build/pdf.worker.min.mjs — re-copy it there
    // if the pdfjs-dist version in package.json is ever bumped.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pageTexts.push(pageText);
    }
    return pageTexts.join("\n\n");
  } catch (error) {
    console.error("PDF extraction failed", error);
    throw new Error("Couldn't read that PDF. It may be scanned/image-based rather than text.");
  }
}

async function extractFromDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    return value;
  } catch (error) {
    console.error("DOCX extraction failed", error);
    throw new Error("Couldn't read that Word document.");
  }
}
