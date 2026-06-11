"use client";

import { StreakCounter } from "@/components/employee/streak-counter";
import { CheckpointSignal } from "@/components/employee/checkpoint-signal";
import { Button } from "@/components/ui/button";
import { POINTS_PER_MCQ } from "@/lib/constants";
import { formatExplanationLines } from "@/lib/mcq-explanation";
import type { McqQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function shouldBlockCheckpointKey(e: KeyboardEvent): boolean {
  if (
    e.key === "Escape" ||
    e.key === "Tab" ||
    e.key === "F5" ||
    e.key === "F11" ||
    e.key === "F12" ||
    e.key.startsWith("Arrow")
  ) {
    return true;
  }
  if (e.altKey) return true;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (["w", "r", "t", "n", "l", "tab", "p"].includes(k)) return true;
  }
  return false;
}

interface MCQCheckpointProps {
  moduleId: string;
  question: McqQuestion;
  open: boolean;
  userEmail?: string;
  moduleTitle?: string;
  batchId?: string;
  totalSlides?: number;
  currentStreak: number;
  bestStreak?: number;
  score: number;
  totalScore: number;
  checkpointNumber: number;
  totalCheckpoints: number;
  variant?: "modal" | "panel";
  onAnswered: (wasCorrect: boolean) => void;
  onContinue: (wasCorrect: boolean) => void;
}

function stripGeneratedCheckpointPrefix(prompt: string): string {
  return prompt
    .replace(/^\s*(checkpoint|question)\s+\d+\s*(?:of\s+\d+)?\s*[:.)-]\s*/i, "")
    .trim();
}

function ExplanationLines({ explanation }: { explanation: string }) {
  const lines = formatExplanationLines(explanation);
  if (!lines.length) return null;

  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line} className="text-sm leading-relaxed text-inherit">
          {line}
        </p>
      ))}
    </div>
  );
}

export function MCQCheckpoint({
  moduleId,
  question,
  open,
  userEmail,
  moduleTitle,
  batchId,
  totalSlides,
  currentStreak,
  bestStreak = 0,
  score,
  totalScore,
  checkpointNumber,
  totalCheckpoints,
  variant = "modal",
  onAnswered,
  onContinue,
}: MCQCheckpointProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [answerExplanation, setAnswerExplanation] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSubmitted(false);
      setWasCorrect(false);
      setCorrectOptionId(null);
      setAnswerExplanation(null);
      setValidating(false);
      setError(null);
    }
  }, [open, question.id]);

  const correctOption = useMemo(
    () => question.options.find((opt) => opt.id === correctOptionId),
    [question.options, correctOptionId],
  );
  const displayPrompt = useMemo(
    () => stripGeneratedCheckpointPrefix(question.prompt),
    [question.prompt],
  );
  const checkpointProgress =
    totalCheckpoints > 0
      ? Math.min(100, Math.max(0, (checkpointNumber / totalCheckpoints) * 100))
      : 0;
  const signalState = submitted ? (wasCorrect ? "success" : "warning") : "active";

  const handleSubmit = async () => {
    if (!selected || validating || submitted) return;

    if (question.id === "gate-fallback") {
      setWasCorrect(true);
      setCorrectOptionId(selected);
      setAnswerExplanation(
        "This checkpoint confirms you can continue when no generated question is available.",
      );
      setSubmitted(true);
      onAnswered(true);
      return;
    }

    setValidating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/modules/${encodeURIComponent(moduleId)}/mcq/${encodeURIComponent(question.id)}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            optionId: selected,
            userEmail,
            moduleTitle,
            batchId,
            totalSlides,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not validate your answer.");
        return;
      }
      const correct = Boolean(data.correct);
      const alreadyAnswered = Boolean(data.alreadyAnswered);
      setWasCorrect(correct);
      setCorrectOptionId(data.correctOptionId ?? null);
      setAnswerExplanation(data.explanation ?? null);
      setSubmitted(true);
      if (!alreadyAnswered) {
        onAnswered(correct);
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleContinue = () => {
    onContinue(wasCorrect);
    setSelected(null);
    setSubmitted(false);
    setWasCorrect(false);
    setCorrectOptionId(null);
    setAnswerExplanation(null);
  };

  const panelMode = variant === "panel";
  const modalMode = !panelMode;

  const blockCheckpointShortcuts = useCallback((e: KeyboardEvent) => {
    if (!shouldBlockCheckpointKey(e)) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!open || panelMode) return;
    window.addEventListener("keydown", blockCheckpointShortcuts, true);
    return () => window.removeEventListener("keydown", blockCheckpointShortcuts, true);
  }, [open, panelMode, blockCheckpointShortcuts]);

  const card = (
    <div
      className={cn(
        "flex w-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-zinc-200/90 bg-white shadow-[var(--shadow-elevated)]",
        panelMode ? "max-w-none" : "h-full max-w-none",
      )}
    >
      <div className="h-1 shrink-0 bg-zinc-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${checkpointProgress}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="h-full bg-[#f15a24]"
        />
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-col gap-2 border-b border-zinc-100 bg-zinc-50/90 sm:flex-row sm:items-center sm:justify-between",
          modalMode ? "px-4 py-2.5 sm:px-5" : "gap-3 px-4 py-3 sm:px-6 sm:py-4",
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#f15a24]/20 bg-white text-[#f15a24]">
            <Lock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <span
            className={cn(
              "font-semibold uppercase tracking-wider text-[#f15a24]",
              modalMode ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            Checkpoint {Math.min(checkpointNumber, Math.max(totalCheckpoints, 1))} of{" "}
            {Math.max(totalCheckpoints, 1)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modalMode && (
            <StreakCounter
              currentStreak={currentStreak}
              bestStreak={bestStreak}
              compact
              tone="light"
              className="min-w-0 px-2.5 py-1.5"
            />
          )}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-semibold text-zinc-700",
              modalMode ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
            Score{" "}
            <span className="font-mono tabular-nums">
              {score}/{totalScore}
            </span>
          </div>
          <div
            className={cn(
              "rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700",
              modalMode ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <Plus className="mr-1 inline h-3 w-3" />
            {POINTS_PER_MCQ}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 p-4 sm:p-5",
          modalMode
            ? "flex flex-col overflow-hidden"
            : "overflow-y-auto overscroll-contain",
        )}
      >
        {modalMode && submitted ? (
          <div className="mb-3 shrink-0">
            <CheckpointSignal
              key={signalState}
              state={signalState}
              progress={checkpointProgress}
              className="h-20"
            />
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-3 sm:items-stretch",
              modalMode ? "mb-3 shrink-0 sm:grid-cols-[1fr_168px]" : "mb-4 sm:mb-5 sm:grid-cols-[1fr_200px]",
            )}
          >
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2e3192]" strokeWidth={1.75} />
                <p
                  className={cn(
                    "font-semibold uppercase tracking-wider text-zinc-500",
                    modalMode ? "text-xs sm:text-sm" : "text-sm",
                  )}
                >
                  Secure checkpoint
                </p>
              </div>
              {!submitted && (
                <p
                  className={cn(
                    "mt-2 leading-relaxed text-zinc-600",
                    modalMode ? "text-sm sm:text-base" : "text-base",
                  )}
                >
                  Choose the response that best follows the training policy and required approval path.
                </p>
              )}
              {!modalMode && (
                <div className="mt-3 max-w-[180px]">
                  <StreakCounter
                    currentStreak={currentStreak}
                    bestStreak={bestStreak}
                    compact
                    tone="light"
                  />
                </div>
              )}
            </div>
            <CheckpointSignal
              key={signalState}
              state={signalState}
              progress={checkpointProgress}
              className={modalMode ? "h-24" : undefined}
            />
          </div>
        )}

        <h2
          className={cn(
            "font-semibold tracking-tight text-zinc-900",
            modalMode
              ? submitted
                ? "shrink-0 text-sm leading-snug line-clamp-2 sm:text-base"
                : "shrink-0 text-base leading-snug sm:text-lg"
              : "text-lg sm:text-xl",
          )}
        >
          {displayPrompt}
        </h2>
        {!submitted && (
          <p className={cn("mt-1 text-zinc-500", modalMode ? "shrink-0 text-xs sm:text-sm" : "text-sm")}>
            Answer this checkpoint to unlock the next step.
          </p>
        )}

        {(!submitted || panelMode) && (
        <ul
          className={cn(
            modalMode ? "mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto" : "mt-5 space-y-2",
          )}
        >
          {question.options.map((opt) => {
            const isSelected = selected === opt.id;
            const showCorrect =
              submitted && correctOptionId !== null && opt.id === correctOptionId;
            const showWrong =
              submitted &&
              isSelected &&
              correctOptionId !== null &&
              opt.id !== correctOptionId;

            return (
              <motion.li
                key={opt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  disabled={submitted || validating}
                  onClick={() => setSelected(opt.id)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-md border px-3.5 py-3 text-left transition-all duration-150",
                    modalMode ? "text-sm sm:text-base" : "px-4 py-3.5 text-base",
                    "hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm",
                    isSelected && !submitted
                      ? "border-[#2e3192]/45 bg-[#2e3192]/5 text-zinc-900 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                    showCorrect && "border-emerald-300 bg-emerald-50 text-emerald-950",
                    showWrong && "border-red-200 bg-red-50 text-red-950",
                    submitted && "cursor-default",
                  )}
                >
                  {isSelected && !submitted && (
                    <motion.span
                      layoutId="selected-answer-glow"
                      className="absolute inset-y-0 left-0 w-1 bg-[#2e3192]"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-xs font-mono uppercase text-zinc-500">
                    {opt.id}
                  </span>
                  <span className="flex-1">{opt.label}</span>
                  {showCorrect && (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                  )}
                  {showWrong && (
                    <XCircle className="ml-auto h-4 w-4 text-red-500" />
                  )}
                </button>
              </motion.li>
            );
          })}
        </ul>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-lg border",
              modalMode ? "mt-3 shrink-0 p-3.5" : "mt-4 p-3 sm:p-4",
              wasCorrect
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-red-200 bg-red-50 text-red-950",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-white",
                  wasCorrect ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-700",
                )}
              >
                {wasCorrect ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className={cn("font-semibold", modalMode ? "text-sm sm:text-base" : "text-base")}>
                  {wasCorrect ? `Correct. +${POINTS_PER_MCQ} points.` : "Incorrect. +0 points."}
                </p>
                {!wasCorrect && selected && (
                  <p className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                    Your answer: {selected.toUpperCase()}.{" "}
                    {question.options.find((o) => o.id === selected)?.label}
                  </p>
                )}
                <p className="mt-1.5 text-xs leading-relaxed sm:text-sm">
                  {correctOption
                    ? `Correct answer: ${correctOption.id.toUpperCase()}. ${correctOption.label}`
                    : "Your response has been recorded for this checkpoint."}
                </p>
                {answerExplanation && (
                  <div className="mt-2 flex gap-1.5 text-xs leading-relaxed sm:text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Why this is correct</p>
                      <ExplanationLines explanation={answerExplanation} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-zinc-100 bg-white",
          modalMode ? "p-3.5 sm:px-5 sm:pb-4" : "p-4 sm:px-6 sm:pb-5",
        )}
      >
        {!submitted ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            disabled={!selected || validating}
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking answer...
              </>
            ) : (
              "Submit answer"
            )}
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={handleContinue}>
            Continue to next slide
          </Button>
        )}
      </div>
    </div>
  );

  const modalLayer =
    open && !panelMode ? (
      <AnimatePresence>
        <motion.div
          key="checkpoint-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-zinc-900/55 backdrop-blur-[2px]"
        />
        <motion.div
          key="checkpoint-dialog"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.99, y: 4 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed inset-0 z-[201] flex items-center justify-center overflow-hidden p-2 sm:p-3"
          onKeyDown={(e) => {
            if (shouldBlockCheckpointKey(e.nativeEvent)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div className="flex h-[min(86dvh,800px)] w-full max-w-3xl min-h-0">
            {card}
          </div>
        </motion.div>
      </AnimatePresence>
    ) : null;

  return (
    <>
      <AnimatePresence>
        {open && panelMode && (
          <motion.div
            key="checkpoint-panel"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="h-full min-h-0 overflow-auto"
          >
            {card}
          </motion.div>
        )}
      </AnimatePresence>
      {typeof document !== "undefined" && modalLayer
        ? createPortal(modalLayer, document.body)
        : null}
    </>
  );
}
