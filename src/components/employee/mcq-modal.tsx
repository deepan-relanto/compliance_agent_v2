"use client";

import { Button } from "@/components/ui/button";
import type { McqQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";

interface McqModalProps {
  question: McqQuestion;
  open: boolean;
  onCorrect: () => void;
}

export function McqModal({ question, open, onCorrect }: McqModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [isWrong, setIsWrong] = useState(false);

  const handleSubmit = () => {
    if (!selected) return;
    setAttempted(true);
    if (selected === question.correctOptionId) {
      setIsWrong(false);
      setTimeout(() => {
        onCorrect();
        setSelected(null);
        setAttempted(false);
      }, 500);
    } else {
      setIsWrong(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white shadow-[var(--shadow-elevated)]">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-6 py-4">
                <Lock className="h-4 w-4 text-[#f15a24]" strokeWidth={1.75} />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#f15a24]">
                  Checkpoint required
                </span>
              </div>
              <div className="p-6">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                  {question.prompt}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Answer correctly to continue. Validated server-side in production.
                </p>
                <ul className="mt-5 space-y-2">
                  {question.options.map((opt) => {
                    const isSelected = selected === opt.id;
                    const showCorrect =
                      attempted && opt.id === question.correctOptionId;
                    const showWrong =
                      attempted && isSelected && opt.id !== question.correctOptionId;

                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (attempted && !isWrong) return;
                            setSelected(opt.id);
                            setIsWrong(false);
                            setAttempted(false);
                          }}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                            isSelected
                              ? "border-[#2e3192]/40 bg-[#2e3192]/5 text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                            showCorrect && "border-emerald-300 bg-emerald-50",
                            showWrong && "border-red-200 bg-red-50",
                          )}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-[10px] font-mono uppercase text-zinc-500">
                            {opt.id}
                          </span>
                          <span>{opt.label}</span>
                          {showCorrect && (
                            <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {isWrong && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Incorrect — review the slide and try again.
                  </p>
                )}
                <Button
                  className="mt-5 w-full"
                  onClick={handleSubmit}
                  disabled={
                    !selected ||
                    (attempted && !isWrong && selected === question.correctOptionId)
                  }
                >
                  Submit answer
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
