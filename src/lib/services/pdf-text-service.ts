import fs from "fs";
import path from "path";

/** Extract plain text per page from a PDF in public/uploads. */
export async function extractPdfPagesText(pdfUrl: string): Promise<string[]> {
  const relative = pdfUrl.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF not found: ${filePath}`);
  }

  const data = new Uint8Array(fs.readFileSync(filePath));

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(text);
  }

  return pages;
}

/** Pages [from..to] inclusive, 1-based slide indices. */
export function chunkPagesForGate(
  pages: string[],
  gateSlide: number,
  windowSize = 3,
): { slideFrom: number; slideTo: number; excerpt: string } {
  const slideTo = Math.min(gateSlide, pages.length);
  const slideFrom = Math.max(1, slideTo - windowSize + 1);
  const excerpt = pages
    .slice(slideFrom - 1, slideTo)
    .map((t, i) => `[Slide ${slideFrom + i}]\n${t || "(no text)"}`)
    .join("\n\n");
  return { slideFrom, slideTo, excerpt };
}
