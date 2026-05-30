"use client";

/**
 * PdfPageViewer — fully isolated client-only PDF renderer.
 *
 * WHY THIS FILE EXISTS AS A SEPARATE COMPONENT:
 * pdfjs-dist v5 is a pure-ESM package. Next.js 15 dev mode uses Webpack's
 * `eval-source-map` devtool which wraps modules in eval(). Inside eval(),
 * the synthetic `exports` object injected by Webpack can be null/non-object
 * in strict-mode ESM scopes. When pdfjs calls Object.defineProperty(exports,…)
 * it throws "Object.defineProperty called on non-object".
 *
 * Two-part fix applied here:
 *  1. This component is dynamically imported with { ssr: false } from
 *     slide-viewer.tsx, creating a separate Webpack async chunk that is only
 *     evaluated by the browser after hydration — never during SSR.
 *  2. The PDF.js worker is loaded from cdnjs CDN instead of being bundled by
 *     Webpack. The CDN script runs in a normal browser script context (not an
 *     eval wrapper), so Object.defineProperty works correctly.
 *
 * Do NOT import react-pdf or pdfjs-dist anywhere else in this project.
 * Keep all PDF logic inside this file.
 */

import { Loader2, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// CSS layers for react-pdf — must be imported alongside Document/Page
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ── Worker setup ─────────────────────────────────────────────────────────────
// Using cdnjs avoids bundling the worker through Webpack's eval pipeline,
// which is what causes the "Object.defineProperty called on non-object" crash.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface PdfPageViewerProps {
  /** Absolute or relative URL of the PDF file */
  pdfUrl: string;
  /** 1-based page number to render */
  pageNumber: number;
  /** Called once the document is loaded; provides the total page count */
  onLoadSuccess: (numPages: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PdfPageViewer({
  pdfUrl,
  pageNumber,
  onLoadSuccess,
}: PdfPageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);

  // Measure the available width so react-pdf fills the container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset page-level loading state when the page number changes
  useEffect(() => {
    setPageLoading(true);
  }, [pageNumber]);

  const handleDocLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setDocError(null);
      onLoadSuccess(numPages);
    },
    [onLoadSuccess],
  );

  const handleDocLoadError = useCallback((err: Error) => {
    console.error("[PdfPageViewer] Failed to load PDF document:", err);
    setDocError("Unable to load the PDF. Please try again or contact support.");
  }, []);

  const handlePageRenderSuccess = useCallback(() => {
    setPageLoading(false);
  }, []);

  // ── Error state ────────────────────────────────────────────────────────────
  if (docError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" strokeWidth={1.5} />
        <p className="max-w-xs text-sm text-zinc-500">{docError}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-start justify-center overflow-auto"
    >
      {/* Loading overlay — shown while the page canvas is being drawn */}
      {pageLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-[#2e3192]" />
        </div>
      )}

      {containerWidth > 0 && (
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocLoadSuccess}
          onLoadError={handleDocLoadError}
          loading={null} // suppress react-pdf's own loading UI; we handle it
          error={null}   // suppress react-pdf's own error UI; we handle it
        >
          <Page
            pageNumber={pageNumber}
            width={containerWidth}
            onRenderSuccess={handlePageRenderSuccess}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
      )}
    </div>
  );
}
