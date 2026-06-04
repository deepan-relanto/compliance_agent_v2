"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, CheckCircle2 } from "lucide-react";

export interface GamificationBadge {
  id: string;
  name: string;
  description: string;
}

interface BadgeUnlockProps {
  badge: GamificationBadge | null;
  onClose: () => void;
}

export function BadgeUnlock({ badge, onClose }: BadgeUnlockProps) {
  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="pointer-events-auto fixed left-1/2 top-16 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2"
          onAnimationComplete={() => {
            window.setTimeout(onClose, 2200);
          }}
        >
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[var(--shadow-elevated)]">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 2.2, ease: "linear" }}
              className="h-1 bg-[#f15a24]"
            />
            <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
                <Award className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Badge unlocked
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-zinc-950">
                  {badge.name}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  {badge.description}
                </p>
              </div>
            </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
