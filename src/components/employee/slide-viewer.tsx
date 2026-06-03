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
import {
  markInProgress,
  isProctorLocked,
  markCompleted,
  getProgress,
  addWarning,
  saveAcknowledgement,
  applyScoreResult,
  resetForScoreRetake,
} from "@/lib/progress-store";
import {
  syncAcknowledgement,
  syncProgressStart,
  finalizeAssessmentScore,
  requestScoreRetake,
} from "@/lib/progress-api";
import { PASS_THRESHOLD_PERCENT } from "@/lib/constants";
import { submitReviewRequest, getAllReviewRequests } from "@/lib/review-store";
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
  const quizOnlyModeFromModule = module.viewerMode === "quiz_only_retake";
  const reviewOnlyMode = module.viewerMode === "review_only";
  const ackPendingMode = module.viewerMode === "acknowledgement_pending";
  const autoStartSession = reviewOnlyMode || quizOnlyModeFromModule || ackPendingMode;

  // ── Fix: initialize from saved progress ──────────────────────────────────
  // useState lazy initializer runs once at mount. Reading localStorage here
  // is safe because SlideViewer is a client-only component (ssr:false import).
  const [slideIndex, setSlideIndex] = useState(0);

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
    return progress ? isProctorLocked(progress) : false;
  });

  const [activeWarningReason, setActiveWarningReason] = useState<string | null>(null);

  // ── Integrity Enhancement States ─────────────────────────────────────────
  const [retakeCount, setRetakeCount] = useState<number>(0);
  const [dbStatus, setDbStatus] = useState<ModuleStatus>("in_progress");
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [showExitModal, setShowExitModal] = useState(false);
  const [showProctorRules, setShowProctorRules] = useState(!autoStartSession);
  const [sessionStarted, setSessionStarted] = useState(autoStartSession);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showScoreResult, setShowScoreResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<{
    scorePercent: number;
    passed: boolean;
    canRetake: boolean;
    mcqCorrect: number;
    mcqTotal: number;
  } | null>(null);
  const [retakeLoading, setRetakeLoading] = useState(false);
  const [quizOnlyIndex, setQuizOnlyIndex] = useState(0);
  const [forceQuizOnlyRetake, setForceQuizOnlyRetake] = useState(false);

  const loadIntegrityState = useCallback(() => {
    if (user?.username) {
      const prog = getProgress(user.username, module.id);
      if (prog) {
        setRetakeCount(prog.retakeCount ?? 0);
        setDbStatus(prog.status);
        setIsFailed(isProctorLocked(prog));
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
  const quizOnlyMode = quizOnlyModeFromModule || forceQuizOnlyRetake;
  const activeQuiz = quizOnlyMode ? moduleMcqs[quizOnlyIndex] : null;

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
    if (!sessionStarted || reviewOnlyMode || quizOnlyModeFromModule) return;
    enterFullscreen();
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [sessionStarted, reviewOnlyMode, quizOnlyModeFromModule, enterFullscreen]);

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

  useEffect(() => {
    if (!autoStartSession) return;
    // Review / quiz-only retake: skip proctor rules and slide deck; go straight to content.
    setShowProctorRules(false);
    setSessionStarted(true);
    if (sessionStartMs === null) {
      setSessionStartMs(Date.now());
    }
  }, [autoStartSession, sessionStartMs]);

  const triggerWarning = useCallback((reason: string) => {
    if (
      !sessionStarted ||
      isExitingRef.current ||
      !user?.username ||
      reviewOnlyMode ||
      quizOnlyMode
    ) {
      return;
    }

    // Check progress status before logging warning
    const currentProgress = getProgress(user.username, module.id);
    if (
      currentProgress &&
      (currentProgress.status === "completed" || isProctorLocked(currentProgress))
    ) {
      return;
    }

    // Call addWarning in store (includes the 5s cooldown check inside)
    const updated = addWarning(user.username, module.id, reason);

    setLiveWarningCount(updated.warningCount);
    setLiveWarningHistory(updated.warningHistory);

    if (isProctorLocked(updated)) {
      setIsFailed(true);
      loadIntegrityState();
    } else if (updated.warningCount !== liveWarningCount) {
      // Show warning modal only if warning count was actually incremented (i.e. not on cooldown)
      setActiveWarningReason(reason);
    }
  }, [
    sessionStarted,
    user?.username,
    module.id,
    liveWarningCount,
    loadIntegrityState,
    reviewOnlyMode,
    quizOnlyMode,
  ]);

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
      if (reviewOnlyMode || isExitingRef.current || !user?.username) return;
      const currentProgress = getProgress(user.username, module.id);
      if (
        currentProgress &&
        (currentProgress.status === "completed" || isProctorLocked(currentProgress))
      ) {
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
  }, [reviewOnlyMode, user?.username, module.id]);

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
      void syncProgressStart({
        userEmail: user.username,
        moduleId: module.id,
        moduleTitle: module.title,
        batchId: user.batchId,
        totalSlides,
        assignedMcqCount: moduleMcqs.length,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, module.id, moduleMcqs.length]);

  // Assessments are one-time: do not persist slide position for resume.

  const openGate = useCallback(() => {
    const mcq =
      moduleMcqs.find((q) => q.slideIndex === slideIndex + 1) ??
      getMcqForSlide() ??
      moduleMcqs[gateIndex % Math.max(moduleMcqs.length, 1)] ??
      FALLBACK_MCQ;
    setGateMcq(mcq);
    setMcqOpen(true);
  }, [moduleMcqs, slideIndex, gateIndex]);

  const handleFinishAttempt = useCallback(async () => {
    if (reviewOnlyMode) {
      isExitingRef.current = true;
      window.location.href = "/dashboard";
      return;
    }
    if (!user?.username) {
      setShowAcknowledgement(true);
      return;
    }

    const result = await finalizeAssessmentScore(user.username, module.id);
    if (result) {
      setScoreResult(result);
      applyScoreResult(user.username, module.id, {
        scorePercent: result.scorePercent,
        passed: result.passed,
        mcqCorrect: result.mcqCorrect,
        mcqTotal: result.mcqTotal,
        failedReason: result.passed
          ? undefined
          : `Score ${result.scorePercent}% is at or below the passing threshold (${PASS_THRESHOLD_PERCENT}%).`,
      });
      if (!result.passed) {
        setMcqOpen(false);
        setShowAcknowledgement(false);
        setShowScoreResult(true);
        return;
      }
    }
    setMcqOpen(false);
    setIsAcknowledged(false);
    setShowAcknowledgement(true);
  }, [reviewOnlyMode, user?.username, module.id]);

  const tryAdvance = useCallback(() => {
    if (quizOnlyMode) {
      if (!moduleMcqs.length) {
        void handleFinishAttempt();
        return;
      }
      setGateMcq(activeQuiz ?? moduleMcqs[0] ?? FALLBACK_MCQ);
      setMcqOpen(true);
      return;
    }
    if (isLastSlide) {
      void handleFinishAttempt();
      return;
    }
    const upcoming = nextClickCount + 1;
    if (!reviewOnlyMode && upcoming % SLIDES_BETWEEN_GATES === 0) {
      setNextClickCount(upcoming);
      openGate();
      return;
    }
    setNextClickCount(upcoming);
    setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
  }, [
    quizOnlyMode,
    moduleMcqs,
    activeQuiz,
    isLastSlide,
    reviewOnlyMode,
    nextClickCount,
    openGate,
    handleFinishAttempt,
    totalSlides,
  ]);

  const handleAcknowledgementSubmit = async () => {
    if (!user?.username) return;
    const feedbackRequired = !!module.feedbackRequired;
    saveAcknowledgement(user.username, module.id, feedbackRequired);
    await syncAcknowledgement({
      userEmail: user.username,
      moduleId: module.id,
      moduleTitle: module.title,
      feedbackRequired,
    });
    setShowAcknowledgement(false);
    setShowFinalQa(true);
  };

  const handleScoreRetake = async () => {
    if (!user?.username) return;
    setRetakeLoading(true);
    const res = await requestScoreRetake(user.username, module.id);
    setRetakeLoading(false);
    if (res.ok) {
      resetForScoreRetake(user.username, module.id);
      setShowScoreResult(false);
      setScoreResult(null);
      setSlideIndex(0);
      setQuizOnlyIndex(0);
      setNextClickCount(0);
      setShowFinalQa(false);
      setFeedbackSubmitted(false);
      setIsAcknowledged(false);
      setShowAcknowledgement(false);
      setForceQuizOnlyRetake(true);
      if (moduleMcqs.length) {
        setGateMcq(moduleMcqs[0]);
        setMcqOpen(true);
      }
    }
  };

  const handleMcqContinue = () => {
    setMcqOpen(false);
    if (quizOnlyMode) {
      const next = quizOnlyIndex + 1;
      if (next < moduleMcqs.length) {
        setQuizOnlyIndex(next);
      } else {
        void handleFinishAttempt();
      }
      return;
    }
    if (!isLastSlide) {
      setSlideIndex((i) => Math.min(i + 1, totalSlides - 1));
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!sessionStarted) return;
      if (quizOnlyMode) return;
      if (mcqOpen || showAcknowledgement || showFinalQa || showScoreResult) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        tryAdvance();
      } else if (e.key === "ArrowLeft" && slideIndex > 0) {
        e.preventDefault();
        setSlideIndex((i) => Math.max(0, i - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    sessionStarted,
    mcqOpen,
    showAcknowledgement,
    showFinalQa,
    showScoreResult,
    slideIndex,
    tryAdvance,
    quizOnlyMode,
  ]);

  useEffect(() => {
    if (!sessionStarted || !ackPendingMode) return;
    setMcqOpen(false);
    setIsAcknowledged(false);
    setShowAcknowledgement(true);
  }, [sessionStarted, ackPendingMode]);

  useEffect(() => {
    if (!sessionStarted || !quizOnlyMode || showAcknowledgement || showFinalQa || showScoreResult) {
      return;
    }
    if (!moduleMcqs.length) return;
    setGateMcq(moduleMcqs[quizOnlyIndex] ?? moduleMcqs[0] ?? FALLBACK_MCQ);
    setMcqOpen(true);
  }, [
    sessionStarted,
    quizOnlyMode,
    quizOnlyIndex,
    moduleMcqs,
    showAcknowledgement,
    showFinalQa,
    showScoreResult,
  ]);

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
          {!reviewOnlyMode && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowExitModal(true);
              }}
              className="h-8 px-3 text-xs"
            >
              Exit
            </Button>
          )}
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
                  <ul className="space-y-2.5 text-xs text-zinc-600 leading-relaxed pl-1">
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
              {quizOnlyMode ? (
                <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center p-4">
                  {!mcqOpen && (
                    <div className="w-full rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-[var(--shadow-card)]">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                        Quiz retake
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-zinc-900">
                        Checkpoint questions only
                      </h2>
                      <p className="mt-2 text-sm text-zinc-500">
                        Slides are skipped. Answer each question to finish this retake.
                      </p>
                      <p className="mt-5 text-sm font-medium text-zinc-700">
                        Question {Math.min(quizOnlyIndex + 1, Math.max(moduleMcqs.length, 1))} of{" "}
                        {Math.max(moduleMcqs.length, 1)}
                      </p>
                    </div>
                  )}
                </div>
              ) : module.contentType === "pdf" && module.pdfUrl ? (
                <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-2xl">
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
                    <div className="w-full max-w-4xl rounded-sm bg-white shadow-xl ring-1 ring-black/20">
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
                    {reviewOnlyMode
                      ? "Review mode: question checkpoints are disabled because this module is already completed."
                      : "Checkpoint every three slides. Answer each question to continue."}
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
              <div className="w-full max-w-2xl space-y-5 px-2 sm:px-0">
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
                  size="large"
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
                    "flex h-12 w-full items-center justify-center rounded-lg text-base font-medium transition-colors",
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

      {!showFinalQa && !showAcknowledgement && !quizOnlyMode && (
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
            {reviewOnlyMode && isLastSlide ? "Back to dashboard" : isLastSlide ? "Finish" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </footer>
      )}

      <McqModal
        moduleId={module.id}
        question={gateMcq}
        open={mcqOpen && !showAcknowledgement && !showFinalQa && !showScoreResult}
        userEmail={user?.username}
        moduleTitle={module.title}
        batchId={user?.batchId}
        totalSlides={totalSlides}
        onContinue={handleMcqContinue}
      />

      {showScoreResult && scoreResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-zinc-200/90 bg-white text-center shadow-[var(--shadow-elevated)]">
            <div
              className={cn(
                "px-8 pb-2 pt-8",
                scoreResult.passed
                  ? "bg-gradient-to-b from-emerald-50/80 to-white"
                  : "bg-gradient-to-b from-red-50/60 to-white",
              )}
            >
              <div
                className={cn(
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4",
                  scoreResult.passed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    scoreResult.passed ? "text-emerald-700" : "text-red-600",
                  )}
                >
                  {scoreResult.scorePercent}%
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900">
                {scoreResult.passed ? "Assessment passed" : "Below passing score"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                You answered {scoreResult.mcqCorrect} of {scoreResult.mcqTotal} checkpoint
                questions correctly.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Passing score is above {PASS_THRESHOLD_PERCENT}%.
              </p>
            </div>
            <div className="border-t border-zinc-100 px-8 py-6">
              {scoreResult.canRetake ? (
                <div className="flex flex-col gap-3">
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={retakeLoading}
                    onClick={handleScoreRetake}
                  >
                    {retakeLoading ? "Preparing retake…" : "Retake quiz only"}
                  </Button>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-zinc-500 transition-colors hover:text-[#2e3192]"
                    onClick={() => {
                      isExitingRef.current = true;
                    }}
                  >
                    Return to dashboard
                  </Link>
                </div>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#2e3192] text-sm font-semibold text-white transition-colors hover:bg-[#3d42a8]"
                  onClick={() => {
                    isExitingRef.current = true;
                  }}
                >
                  Return to dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
                <li>The assessment session will end.</li>
                <li>If you leave before finishing, you must start again from the beginning.</li>
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
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => {
                  isExitingRef.current = true;
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
                  <p className="font-bold text-red-800">Review Request Rejected</p>
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
                      variant="primary"
                      className="w-full text-xs font-semibold"
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
                          variant="primary"
                          size="sm"
                          className="flex-1 text-xs"
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
