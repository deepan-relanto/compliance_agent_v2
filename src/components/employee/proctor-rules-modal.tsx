"use client";

import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Clock,
  Copy,
  Eye,
  Maximize2,
  ShieldAlert,
} from "lucide-react";

interface ProctorRulesModalProps {
  open: boolean;
  moduleTitle: string;
  onAccept: () => void;
}

const RULES = [
  { icon: Maximize2, text: "You must remain in fullscreen for the entire session." },
  { icon: Ban, text: "Do not switch tabs, minimize the window, or open other applications." },
  { icon: Copy, text: "Copying, screenshots, and printing are not permitted." },
  { icon: Eye, text: "Your session is monitored. Violations add warnings (3 = fail)." },
  { icon: Clock, text: "A session timer will run from the moment you begin." },
];

export function ProctorRulesModal({
  open,
  moduleTitle,
  onAccept,
}: ProctorRulesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-zinc-900/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-zinc-200/90 bg-white shadow-[var(--shadow-elevated)]">
              <div className="border-b border-zinc-100 bg-[#2e3192]/5 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#2e3192]/10">
                    <ShieldAlert className="h-5 w-5 text-[#2e3192]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                      Proctored assessment
                    </p>
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                      {moduleTitle}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm text-zinc-600">
                  Before you begin, confirm you understand these rules. The session
                  starts only after you accept.
                </p>
                <ul className="mt-4 space-y-3">
                  {RULES.map((rule) => (
                    <li
                      key={rule.text}
                      className="flex items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm text-zinc-700"
                    >
                      <rule.icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#2e3192]"
                        strokeWidth={1.75}
                      />
                      {rule.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onAccept}
                >
                  I understand — begin assessment
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
