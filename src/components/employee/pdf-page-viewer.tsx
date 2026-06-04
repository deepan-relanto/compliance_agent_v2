"use client";

/**
 * PdfPageViewer — client-only PDF renderer (react-pdf / pdfjs-dist).
 * Loads the document once; only the page canvas updates when pageNumber changes.
 */

import { Loader2, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfPageViewerProps {
  pdfUrl: string;
  pageNumber: number;
  onLoadSuccess: (numPages: number) => void;
}

export function PdfPageViewer({
  pdfUrl,
  pageNumber,
  onLoadSuccess,
}: PdfPageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [pageRendering, setPageRendering] = useState(true);

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

  useEffect(() => {
    setNumPages(null);
    setDocError(null);
    setPageRendering(true);
  }, [pdfUrl]);

  useEffect(() => {
    if (numPages != null) setPageRendering(true);
  }, [pageNumber, numPages]);

  const handleDocLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setDocError(null);
      setNumPages(total);
      onLoadSuccess(total);
    },
    [onLoadSuccess],
  );

  const handleDocLoadError = useCallback((err: Error) => {
    console.warn("[PdfPageViewer] Failed to load PDF:", err);
    setDocError(
      "Unable to load the PDF. It may have been removed — contact your administrator.",
    );
    setPageRendering(false);
  }, []);

  const handlePageRenderSuccess = useCallback(() => {
    setPageRendering(false);
  }, []);

  const docLoading = numPages === null && !docError;

  if (docError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" strokeWidth={1.5} />
        <p className="max-w-xs text-sm text-zinc-500">{docError}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[320px] w-full items-center justify-center overflow-auto py-2"
    >
      {(docLoading || pageRendering) && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center ${
            docLoading ? "bg-white/90" : "bg-white/40"
          }`}
        >
          <Loader2 className="h-6 w-6 animate-spin text-[#2e3192]" />
        </div>
      )}

      {containerWidth > 0 && (
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocLoadSuccess}
          onLoadError={handleDocLoadError}
          loading={null}
          error={null}
          options={{
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/standard_fonts/`,
          }}
        >
          {numPages != null && pageNumber >= 1 && pageNumber <= numPages && (
            <Page
              key={`page-${pageNumber}`}
              pageNumber={pageNumber}
              width={containerWidth}
              onRenderSuccess={handlePageRenderSuccess}
              onRenderError={() => setPageRendering(false)}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          )}
        </Document>
      )}
    </div>
  );
}
