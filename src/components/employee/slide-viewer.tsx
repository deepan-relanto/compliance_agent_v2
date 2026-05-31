"use client";

import { FinalQaForm } from "@/components/employee/final-qa-form";
import { McqModal } from "@/components/employee/mcq-modal";
import { RelantoLogo } from "@/components/brand/relanto-logo";
import { Button } from "@/components/ui/button";
import { getMcqForSlide } from "@/lib/mock-data";
import type { McqQuestion, TrainingModule, WarningHistoryEntry, ReviewRequest, ModuleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ProctorRulesModal } from "@/components/employee/proctor-rules-modal";
import { ChevronLeft, ChevronRight, Clock, FileText, Maximize2, Minimize2, ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { markInProgress, markCompleted, saveSlideProgress, getProgress, addWarning, saveAcknowledgement } from "@/lib/progress-store";
import { getPendingRequest, submitReviewRequest, getAllReviewRequests } from "@/lib/review-store";
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
  prompt: "No checkpoint question is available for this slide. Select any option to continue.",
  options: [
    { id: "a", label: "Continue training" },
    { id: "b", label: "Continue training (alternate)" },
    { id: "c", label: "Continue training (alternate 2)" },
    { id: "d", label: "Continue training (alternate 3)" },
  ],
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface SlideViewerProps {
  module: TrainingModule;
  mcqs?: McqQuestion[];
}

export function SlideViewer({ module, mcqs = [] }: SlideViewerProps) {
  const user = useAuthStore((s) => s.user);

  // PDF modules: slides array drives the progress bar + navigation counts.
  // Real page count is detected by react-pdf and updates this via setNumPages.
  const [numPages, setNumPages] = useState<number>(module.slideCount);
  const slides =
    module.contentType === "pdf"
      ? Array.from({ length: numPages }, (_, i) => `Page ${i + 1}`)
      : [`${module.title} — content`];
  const totalSlides = slides.length;
  const moduleMcqs = mcqs;

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
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // ── Integrity Monitoring State ──────────────────────────────────────────
  const [liveWarningCount, setLiveWarningCount] = useState<number>(() => {
    if (!user?.username) return 0;
    const progress = getProgress(user.username, module.id);
    return progress?.warningCount ?? 0;
  });

  const [liveWarningHistory, setLiveWarningHistory] = useState<WarningHistoryEntry[]>(() => {
    if (!user?.username) return [];
    const progress = getProgress(user.username, module.id);
    return progress?.warningHistory ?? [];
  });

  const [isFailed, setIsFailed] = useState<boolean>(() => {
    if (!user?.username) return false;
    const progress = getProgress(user.username, module.id);
    return progress?.status === "failed" || progress?.status === "permanently_failed";
  });

  const [activeWarningReason, setActiveWarningReason] = useState<string | null>(null);

  // ── Integrity Enhancement States ─────────────────────────────────────────
  const [retakeCount, setRetakeCount] = useState<number>(0);
  const [dbStatus, setDbStatus] = useState<ModuleStatus>("in_progress");
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showProctorRules, setShowProctorRules] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const loadIntegrityState = useCallback(() => {
    if (user?.username) {
      const prog = getProgress(user.username, module.id);
      if (prog) {
        setRetakeCount(prog.retakeCount ?? 0);
        setDbStatus(prog.status);
        setIsFailed(prog.status === "failed" || prog.status === "permanently_failed");
      }
      const requests = getAllReviewRequests();
      const userReqs = requests.filter(
        (r) => r.username === user.username && r.moduleId === module.id
      );
      if (userReqs.length > 0) {
        setReviewRequest(userReqs[0]);
      } else {
        setReviewRequest(null);
      }
    }
  }, [user?.username, module.id]);

  useEffect(() => {
    loadIntegrityState();
  }, [loadIntegrityState]);

  const isExitingRef = useRef(false);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!sessionStarted) return;
    enterFullscreen();
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [sessionStarted, enterFullscreen]);

  useEffect(() => {
    if (!sessionStarted || sessionStartMs === null) return;
    const tick = () => setElapsedMs(Date.now() - sessionStartMs);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStarted, sessionStartMs]);

  const handleBeginSession = () => {
    setShowProctorRules(false);
    setSessionStarted(true);
    setSessionStartMs(Date.now());
    enterFullscreen();
  };

  const triggerWarning = useCallback((reason: string) => {
    if (!sessionStarted || isExitingRef.current || !user?.username) return;

    // Check progress status before logging warning
    const currentProgress = getProgress(user.username, module.id);
    if (
      currentProgress?.status === "completed" ||
      currentProgress?.status === "failed" ||
      currentProgress?.status === "permanently_failed"
    ) {
      return;
    }

    // Call addWarning in store (includes the 5s cooldown check inside)
    const updated = addWarning(user.username, module.id, reason);

    setLiveWarningCount(updated.warningCount);
    setLiveWarningHistory(updated.warningHistory);

    if (updated.status === "failed" || updated.status === "permanently_failed") {
      setIsFailed(true);
      loadIntegrityState();
    } else if (updated.warningCount !== liveWarningCount) {
      // Show warning modal only if warning count was actually incremented (i.e. not on cooldown)
      setActiveWarningReason(reason);
    }
  }, [sessionStarted, user?.username, module.id, liveWarningCount, loadIntegrityState]);

  useEffect(() => {
    const onFsChange = () => {
      if (isExitingRef.current || isFailed) return;
      if (document.fullscreenElement === null) {
        setIsFullscreen(false);
        triggerWarning("Exited Fullscreen");
      } else {
        setIsFullscreen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [triggerWarning, isFailed]);

  // ── Tab Switch / Visibility Monitoring ───────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isExitingRef.current || isFailed) return;
      if (document.visibilityState === "hidden") {
        triggerWarning("Switched Browser Tab");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [triggerWarning, isFailed]);

  // ── Window Focus Defocus Grace Period Monitoring ────────────────────────
  useEffect(() => {
    const handleBlur = () => {
      if (isExitingRef.current || isFailed) return;
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => {
        triggerWarning("Window Lost Focus");
      }, 3000); // 3-second grace period
    };

    const handleFocus = () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, [triggerWarning, isFailed]);

  // ── Navigation (Refresh / Leave page) Monitoring ─────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExitingRef.current || !user?.username) return;
      const currentProgress = getProgress(user.username, module.id);
      if (currentProgress?.status === "completed" || currentProgress?.status === "failed") {
        return;
      }

      // Record warning synchronously in localStorage before exit
      addWarning(user.username, module.id, "Attempted Navigation");

      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user?.username, module.id]);

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
      moduleMcqs.find((q) => q.slideIndex === slideIndex + 1) ??
      getMcqForSlide() ??
      moduleMcqs[gateIndex % Math.max(moduleMcqs.length, 1)] ??
      FALLBACK_MCQ;
    setGateMcq(mcq);
    setMcqOpen(true);
  };

  const tryAdvance = () => {
    if (isLastSlide) {
      setShowAcknowledgement(true);
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

  const handleAcknowledgementSubmit = () => {
    if (!user?.username) return;
    const feedbackRequired = !!module.feedbackRequired;
    saveAcknowledgement(user.username, module.id, feedbackRequired);
    setShowAcknowledgement(false);
    setShowFinalQa(true);
  };

  const handleMcqContinue = () => {
    setMcqOpen(false);
    if (!isLastSlide) {
      setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
    }
  };

  if (!sessionStarted) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-100">
        <ProctorRulesModal
          open={showProctorRules}
          moduleTitle={module.title}
          onAccept={handleBeginSession}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-zinc-900">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-white">
        <RelantoLogo size="sm" showTagline={false} />
        <span className="hidden truncate text-sm font-medium text-zinc-300 sm:inline max-w-[240px]">
          {module.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300">
            <Clock className="h-3 w-3" />
            {formatElapsed(elapsedMs)}
          </span>
          {liveWarningCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-950 px-2 py-1 text-xs font-semibold text-amber-400 border border-amber-800">
              Warnings: {liveWarningCount} / 3
            </span>
          )}
          <span className="font-mono text-xs text-zinc-400">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowExitModal(true);
            }}
            className="h-8 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white px-3 text-xs"
          >
            Exit
          </Button>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {showAcknowledgement ? (
            <motion.div
              key="acknowledgement"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 items-center justify-center p-6 sm:p-10"
            >
              <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#2e3192]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950">Training Acknowledgement</h2>
                    <p className="text-xs text-zinc-500">Please review the compliance declaration below.</p>
                  </div>
                </div>

                <div className="rounded-md bg-zinc-50 border border-zinc-200/60 p-4 space-y-3">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider">I acknowledge that:</p>
                  <ul className="space-y-2.5 text-xs text-zinc-650 leading-relaxed pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-[#f15a24] font-bold mt-0.5">•</span>
                      <span>I have completed this training material.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#f15a24] font-bold mt-0.5">•</span>
                      <span>I have reviewed and understood the concepts presented in this assessment.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#f15a24] font-bold mt-0.5">•</span>
                      <span>I have completed this assessment honestly and without unauthorized assistance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#f15a24] font-bold mt-0.5">•</span>
                      <span>I understand that compliance with these guidelines is my responsibility.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#f15a24] font-bold mt-0.5">•</span>
                      <span>The information provided during this assessment is accurate to the best of my knowledge.</span>
                    </li>
                  </ul>
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-zinc-100 bg-zinc-50/30 p-3.5 hover:bg-zinc-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAcknowledged}
                    onChange={(e) => setIsAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#2e3192] focus:ring-[#2e3192]/30 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-zinc-800">
                      I acknowledge and agree to the statements above.
                    </span>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      By checking this box, you confirm your compliance attestation.
                    </p>
                  </div>
                </label>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs border-zinc-200 text-zinc-700 h-10 hover:bg-zinc-50"
                    onClick={() => {
                      setShowAcknowledgement(false);
                    }}
                  >
                    Back to Assessment
                  </Button>
                  <Button
                    className="flex-1 text-xs bg-[#2e3192] hover:bg-[#3d42a8] text-white font-semibold h-10 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={!isAcknowledged}
                    onClick={handleAcknowledgementSubmit}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : !showFinalQa ? (
            <motion.div
              key={slideIndex}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1 flex-col p-4 sm:p-6"
            >
              {module.contentType === "pdf" && module.pdfUrl ? (
                <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-2xl">
                  <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                      Page {slideIndex + 1} of {numPages}
                    </p>
                    <div className="flex items-center gap-2 text-zinc-500">
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span className="max-w-[200px] truncate text-xs">{module.title}</span>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-zinc-800/50 p-6">
                    <div className="w-full max-w-3xl rounded-sm bg-white shadow-xl ring-1 ring-black/20">
                      <PdfPageViewer
                        pdfUrl={module.pdfUrl!}
                        pageNumber={slideIndex + 1}
                        onLoadSuccess={(n) => {
                          setNumPages(n);
                          updateUploadedAssessmentSlideCount();
                        }}
                      />
                    </div>
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
                    Checkpoint every three slides. Answer each question to continue.
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
                {module.feedbackRequired && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex gap-2 text-xs text-amber-800">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-semibold">Feedback Submission Required</p>
                      <p className="text-amber-700 mt-0.5">
                        This training module requires you to submit feedback or ask questions before completion.
                      </p>
                    </div>
                  </div>
                )}
                <FinalQaForm
                  moduleTitle={module.title}
                  moduleId={module.id}
                  userId={user?.username ?? ""}
                  onSuccess={() => {
                    setFeedbackSubmitted(true);
                    if (user?.username) {
                      markCompleted(user.username, module.id);
                    }
                  }}
                />
                <Link
                  href="/dashboard"
                  onClick={() => {
                    isExitingRef.current = true;
                  }}
                  className={cn(
                    "flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors",
                    (module.feedbackRequired && !feedbackSubmitted)
                      ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      : "bg-[#2e3192] text-white hover:bg-[#3d42a8]"
                  )}
                >
                  {(module.feedbackRequired && !feedbackSubmitted) ? "Exit without completing" : "Return to dashboard"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!showFinalQa && !showAcknowledgement && (
        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={slideIndex === 0}
            onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
            className="text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
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
                  i <= slideIndex ? "bg-[#f15a24]" : "bg-zinc-700",
                )}
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={tryAdvance}
            className="bg-[#f15a24] hover:bg-[#d94e1f] text-white"
          >
            {isLastSlide ? "Finish" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </footer>
      )}

      <McqModal
        moduleId={module.id}
        question={gateMcq}
        open={mcqOpen}
        onContinue={handleMcqContinue}
      />

      {/* ── Warning Notification Modal overlay ────────────────────────────── */}
      {activeWarningReason && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-white p-6 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-250">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <span className="text-lg font-bold text-amber-600">!</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-zinc-900">Warning {liveWarningCount} of 3</h3>
              <p className="text-sm text-zinc-500 leading-relaxed text-balance">
                {activeWarningReason === "Exited Fullscreen" && "You exited fullscreen mode."}
                {activeWarningReason === "Switched Browser Tab" && "You switched browser tabs."}
                {activeWarningReason === "Window Lost Focus" && "The assessment lost window focus."}
                {activeWarningReason === "Attempted Navigation" && "You attempted to navigate away."}
              </p>
              <p className="text-xs text-amber-600 font-semibold">
                Warnings Remaining: {3 - liveWarningCount}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                If you accumulate 3 warnings, the assessment will automatically fail.
              </p>
            </div>
            <Button
              className="w-full bg-[#2e3192] text-white hover:bg-[#3d42a8]"
              onClick={async () => {
                setActiveWarningReason(null);
                // Re-enter fullscreen when possible
                try {
                  if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                    setIsFullscreen(true);
                  }
                } catch {
                  setIsFullscreen(true);
                }
              }}
            >
              Continue Assessment
            </Button>
          </div>
        </div>
      )}

      {/* ── Exit Confirmation Modal overlay ─────────────────────────────── */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-zinc-900 text-left">Exit Assessment?</h3>
            <div className="text-xs text-zinc-500 space-y-2 leading-relaxed text-left">
              <p>You are about to leave this assessment.</p>
              <p className="font-semibold text-zinc-600">If you exit now:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Your current progress will be saved.</li>
                <li>The assessment session will end.</li>
                <li>You can return later and continue from where you left off (if not failed).</li>
              </ul>
              <p className="mt-2 font-medium">Do you want to proceed?</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-zinc-200 text-zinc-700"
                onClick={() => setShowExitModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-650 text-white hover:bg-red-700 text-xs"
                onClick={() => {
                  isExitingRef.current = true;
                  if (user?.username) {
                    saveSlideProgress(user.username, module.id, slideIndex);
                  }
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => undefined);
                  }
                  window.location.href = "/dashboard";
                }}
              >
                Exit Assessment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Failed Lock Screen Overlay ─────────────────────────────────────── */}
      {isFailed && (() => {
        const retakesRemaining = Math.max(0, 2 - retakeCount);
        const isPendingReview = reviewRequest?.status === "Pending";
        const isRejectedReview = reviewRequest?.status === "Rejected";
        const isPermanentlyFailed =
          dbStatus === "permanently_failed" ||
          (liveWarningCount >= 3 && retakesRemaining <= 0);

        const handleSubmitReview = (e: React.FormEvent) => {
          e.preventDefault();
          if (!explanation.trim()) {
            setReviewError("Please provide an explanation.");
            return;
          }
          if (!user?.username) return;

          try {
            submitReviewRequest(
              user.username,
              module.id,
              module.title,
              liveWarningCount,
              Date.now(),
              explanation.trim()
            );
            setReviewSuccess(true);
            setExplanation("");
            setReviewError("");
            loadIntegrityState();
          } catch (err: unknown) {
            setReviewError(
              err instanceof Error ? err.message : "Failed to submit request.",
            );
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <span className="text-xl font-bold text-red-600">!</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-zinc-950">
                  {isPermanentlyFailed ? "Assessment Permanently Failed" : "Assessment Failed"}
                </h2>
                <p className="text-xs text-zinc-500">
                  {isPermanentlyFailed
                    ? "Maximum retake limit reached. This assessment can no longer be retaken."
                    : "Maximum warning limit reached."}
                </p>
                <p className="text-sm font-semibold text-red-600">
                  Warnings: {liveWarningCount} / 3
                </p>
                {!isPermanentlyFailed && !isPendingReview && (
                  <p className="text-xs text-zinc-400">
                    Retakes Remaining: {retakesRemaining}
                  </p>
                )}
              </div>

              <div className="border-t border-b border-zinc-100 py-3 text-left">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Warning History</p>
                <div className="max-h-24 overflow-y-auto space-y-1.5 font-mono text-[10px] text-zinc-500 pr-1">
                  {liveWarningHistory.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-zinc-50 pb-0.5">
                      <span className="font-sans text-zinc-700">{item.reason}</span>
                      <span>
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Case A: Permanently Failed details */}
              {isPermanentlyFailed && (
                <div className="rounded-md bg-zinc-950 text-zinc-100 p-3 text-left space-y-1 text-xs">
                  <p className="font-bold text-zinc-200">Maximum Retake Limit Reached</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    This assessment can no longer be retaken as it has reached the absolute retake limit (2 retakes). Please contact compliance.
                  </p>
                </div>
              )}

              {/* Case B: Pending Review details */}
              {isPendingReview && (
                <div className="rounded-md bg-amber-50 border border-amber-100 p-3 text-left space-y-1 text-xs text-amber-900">
                  <p className="font-bold text-amber-800">A review request is already under review</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    You have already submitted a review request. The compliance administrator will review it.
                  </p>
                </div>
              )}

              {/* Case C: Rejected Review details */}
              {isRejectedReview && !isPendingReview && !isPermanentlyFailed && (
                <div className="rounded-md bg-red-50 border border-red-100 p-3 text-left space-y-1 text-xs text-red-900">
                  <p className="font-bold text-red-850">Review Request Rejected</p>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    Admin Comment: &ldquo;{reviewRequest?.adminComment || "No comments provided."}&rdquo;
                  </p>
                  <p className="text-[10px] text-red-500 mt-1">
                    You may submit another explanation if you have remaining retakes.
                  </p>
                </div>
              )}

              {/* Form or Request Button */}
              {!isPermanentlyFailed && !isPendingReview && (
                <div className="space-y-4 pt-1">
                  {!showReviewForm ? (
                    <Button
                      className="w-full bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold"
                      onClick={() => setShowReviewForm(true)}
                    >
                      Request Review
                    </Button>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-3 text-left">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700">Reason for Failure</label>
                        <textarea
                          rows={3}
                          className="w-full rounded-md border border-zinc-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2e3192]"
                          placeholder="Please explain why the assessment integrity rules were violated. Provide any relevant context or explanation."
                          value={explanation}
                          onChange={(e) => setExplanation(e.target.value)}
                        />
                      </div>
                      {reviewError && (
                        <p className="text-xs text-red-600 font-medium">{reviewError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => {
                            setShowReviewForm(false);
                            setExplanation("");
                            setReviewError("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          className="flex-1 bg-blue-600 text-white hover:bg-blue-700 text-xs"
                        >
                          Submit Request
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <Button
                className="w-full bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
                onClick={() => {
                  isExitingRef.current = true;
                  window.location.href = "/dashboard";
                }}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
