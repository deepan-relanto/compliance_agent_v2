"use client";

import { FinalQaForm } from "@/components/employee/final-qa-form";
import { McqModal } from "@/components/employee/mcq-modal";
import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { getMcqForSlide, MOCK_MCQS, SLIDE_CONTENT } from "@/lib/mock-data";
import type { McqQuestion, TrainingModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const slides = SLIDE_CONTENT[module.id] ?? ["Slide content"];
  const totalSlides = slides.length;
  const moduleMcqs = MOCK_MCQS[module.id] ?? [];

  const [slideIndex, setSlideIndex] = useState(0);
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
            </motion.div>
          ) : (
            <motion.div
              key="final"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 items-center justify-center p-6"
            >
              <div className="w-full max-w-md space-y-4">
                <FinalQaForm moduleTitle={module.title} />
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
