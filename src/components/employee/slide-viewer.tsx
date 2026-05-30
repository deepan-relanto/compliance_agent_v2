"use client";

import { FinalQaForm } from "@/components/employee/final-qa-form";
import { McqModal } from "@/components/employee/mcq-modal";
import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { getMcqForSlide, MOCK_MCQS, SLIDE_CONTENT } from "@/lib/mock-data";
import type { McqQuestion, TrainingModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileText, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { markInProgress, markCompleted, saveSlideProgress, getProgress } from "@/lib/progress-store";
import { updateUploadedAssessmentSlideCount } from "@/lib/mock-data";

// Isolated client-only PDF renderer — dynamically imported so pdfjs-dist is
// never bundled into the SSR pass (fixes "Object.defineProperty called on
// non-object" which happens when Webpack eval wraps pdfjs ESM modules).
const PdfPageViewer = dynamic(
  () => import("@/components/employee/pdf-page-viewer").then((m) => m.PdfPageViewer),
  { ssr: false },
);

const SLIDES_BETWEEN_GATES = 3;

const FALLBACK_MCQ: McqQuestion = {
  id: "gate-fallback",
  slideIndex: -1,
  prompt: "Which approach prevents skipping mandatory training checkpoints?",
  options: [
    { id: "a", label: "Client-only slide counters" },
    { id: "b", label: "Server-validated checkpoint gates" },
    { id: "c", label: "Optional honor-system quizzes" },
    { id: "d", label: "Downloadable PDF attestations" },
  ],
  correctOptionId: "b",
};

interface SlideViewerProps {
  module: TrainingModule;
}

export function SlideViewer({ module }: SlideViewerProps) {
  const user = useAuthStore((s) => s.user);

  // PDF modules: slides array drives the progress bar + navigation counts.
  // Real page count is detected by react-pdf and updates this via setNumPages.
  const [numPages, setNumPages] = useState<number>(module.slideCount);
  const slides =
    module.contentType === "pdf"
      ? Array.from({ length: numPages }, (_, i) => `Page ${i + 1}`)
      : (SLIDE_CONTENT[module.id] ?? ["Slide content"]);
  const totalSlides = slides.length;
  const moduleMcqs = MOCK_MCQS[module.id] ?? [];

  // ── Fix: initialize from saved progress ──────────────────────────────────
  // useState lazy initializer runs once at mount. Reading localStorage here
  // is safe because SlideViewer is a client-only component (ssr:false import).
  const [slideIndex, setSlideIndex] = useState<number>(() => {
    if (!user?.username) return 0;
    const saved = getProgress(user.username, module.id);
    // Only restore if the assessment is in_progress (not completed)
    if (saved && saved.status === "in_progress" && saved.currentSlide > 0) {
      return saved.currentSlide;
    }
    return 0;
  });

  // ── Fix: first-render guard to prevent overwriting saved position ─────────
  // saveSlideProgress must NOT fire on mount (slideIndex just initialized to
  // the saved value — writing it back immediately would corrupt future saves
  // if the effect ran before markInProgress had a chance to write the record).
  const isMounted = useRef(false);

  const [nextClickCount, setNextClickCount] = useState(0);
  const [mcqOpen, setMcqOpen] = useState(false);
  const [gateMcq, setGateMcq] = useState<McqQuestion>(FALLBACK_MCQ);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFinalQa, setShowFinalQa] = useState(false);

  const isLastSlide = slideIndex === totalSlides - 1;
  const gateIndex = useMemo(
    () => Math.floor(nextClickCount / SLIDES_BETWEEN_GATES),
    [nextClickCount],
  );

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    enterFullscreen();
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [enterFullscreen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Progress tracking ────────────────────────────────────────────────────
  // Mark in_progress when the viewer mounts (user opened the assessment).
  useEffect(() => {
    if (user?.username) {
      markInProgress(
        user.username,
        module.id,
        module.title,
        user.batchId,
        totalSlides,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, module.id]);

  // Persist slide position whenever the user navigates.
  // Guard: skip the initial mount so we never overwrite the restored position
  // (slideIndex starts at the saved value — writing it back immediately would
  // defeat the restore if the progress record doesn't exist yet).
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return; // skip mount — position was just loaded, not navigated
    }
    if (user?.username) {
      saveSlideProgress(user.username, module.id, slideIndex);
    }
  }, [user?.username, module.id, slideIndex]);

  const openGate = () => {
    const mcq =
      getMcqForSlide(module.id, slideIndex) ??
      moduleMcqs[gateIndex % Math.max(moduleMcqs.length, 1)] ??
      FALLBACK_MCQ;
    setGateMcq(mcq);
    setMcqOpen(true);
  };

  const tryAdvance = () => {
    if (isLastSlide) {
      // Mark completed BEFORE showing the feedback form
      if (user?.username) markCompleted(user.username, module.id);
      setShowFinalQa(true);
      return;
    }
    const upcoming = nextClickCount + 1;
    if (upcoming % SLIDES_BETWEEN_GATES === 0) {
      setNextClickCount(upcoming);
      openGate();
      return;
    }
    setNextClickCount(upcoming);
    setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
  };

  const handleMcqCorrect = () => {
    setMcqOpen(false);
    if (!isLastSlide) {
      setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-zinc-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
        <RelantoLogo size="sm" showTagline={false} />
        <span className="hidden text-sm font-medium text-zinc-600 sm:inline">
          {module.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {slideIndex + 1} / {totalSlides}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Exit
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!showFinalQa ? (
            <motion.div
              key={slideIndex}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 items-center justify-center p-6 sm:p-10"
            >
              {module.contentType === "pdf" && module.pdfUrl ? (
                // ── PDF assessment: one page at a time via react-pdf ───────
                <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                      Page {slideIndex + 1} of {numPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} />
                      <span className="text-xs text-zinc-400">{module.title}</span>
                    </div>
                  </div>
                  {/* Scrollable PDF canvas area — only the current page is rendered */}
                  <div className="flex flex-1 items-center justify-center overflow-auto bg-zinc-100 p-4">
                    <PdfPageViewer
                      pdfUrl={module.pdfUrl!}
                      pageNumber={slideIndex + 1}
                      onLoadSuccess={(n) => {
                        // Update in-memory page count for the viewer header + progress dots
                        setNumPages(n);
                        // Migration: patch the stored assessment record if the page
                        // count was wrong (e.g. the old hardcoded slideCount:10).
                        // No-ops if count is already correct or module is a demo module.
                        updateUploadedAssessmentSlideCount(module.id, n);
                      }}
                    />
                  </div>
                </div>
              ) : (
                // Text-based demo slide (existing behavior — unchanged)
                <div className="w-full max-w-3xl rounded-md border border-zinc-200 bg-white p-8 shadow-[var(--shadow-card)] sm:p-12">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                    Slide {slideIndex + 1}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl text-balance">
                    {slides[slideIndex]}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                    Checkpoint every three slides. You cannot skip ahead without a
                    correct answer.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="final"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center p-6"
            >
              <div className="w-full max-w-md space-y-4">
                <FinalQaForm
                  moduleTitle={module.title}
                  moduleId={module.id}
                  userId={user?.username ?? ""}
                />
                <Link
                  href="/dashboard"
                  className="flex h-10 w-full items-center justify-center rounded-md bg-[#2e3192] text-sm font-medium text-white hover:bg-[#3d42a8]"
                >
                  Return to dashboard
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!showFinalQa && (
        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-5">
          <Button
            variant="ghost"
            size="sm"
            disabled={slideIndex === 0}
            onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex gap-1">
            {slides.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-5 rounded-md transition-colors",
                  i <= slideIndex ? "bg-[#2e3192]" : "bg-zinc-200",
                )}
              />
            ))}
          </div>
          <Button size="sm" onClick={tryAdvance}>
            {isLastSlide ? "Finish" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </footer>
      )}

      <McqModal question={gateMcq} open={mcqOpen} onCorrect={handleMcqCorrect} />
    </div>
  );
}
