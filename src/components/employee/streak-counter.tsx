"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCounterProps {
  currentStreak: number;
  bestStreak?: number;
  compact?: boolean;
  className?: string;
}

function streakMessage(currentStreak: number): string {
  if (currentStreak >= 3) return `${currentStreak}-question streak`;
  if (currentStreak === 2) return "Great momentum";
  return "Keep going";
}

export function StreakCounter({
  currentStreak,
  bestStreak = 0,
  compact = false,
  className,
}: StreakCounterProps) {
  return (
    <div
      className={cn(
        "flex min-w-[132px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white",
        className,
      )}
    >
      <motion.div
        key={currentStreak}
        initial={{ scale: 0.9, y: 2 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 22 }}
      >
        <Flame
          className={cn("h-4 w-4", currentStreak > 0 ? "text-[#f15a24]" : "text-zinc-500")}
          strokeWidth={1.8}
        />
      </motion.div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Streak
        </p>
        <p className="truncate text-xs font-semibold text-zinc-100">
          {compact ? `${currentStreak} now / ${bestStreak} best` : streakMessage(currentStreak)}
        </p>
      </div>
    </div>
  );
}
