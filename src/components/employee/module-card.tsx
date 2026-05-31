"use client";

import { StatusBadge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { getProgress, getModuleStatus } from "@/lib/progress-store";
import type { ModuleStatus, TrainingModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, FileText, Layers, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ModuleCardProps {
  module: TrainingModule;
}

const statusAccent: Record<ModuleStatus, string> = {
  not_started: "bg-[#2e3192]",
  in_progress: "bg-[#f15a24]",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  permanently_failed: "bg-zinc-800",
};

export function ModuleCard({ module }: ModuleCardProps) {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<ModuleStatus>(module.status);
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (!user?.username) return;
    const p = getProgress(user.username, module.id);
    if (p) {
      setStatus(p.status);
      const pct =
        p.status === "completed"
          ? 100
          : p.totalSlides > 0
            ? Math.round(((p.currentSlide + 1) / p.totalSlides) * 100)
            : 0;
      setProgressPercent(pct);
    } else {
      const s = getModuleStatus(user.username, module.id);
      setStatus(s);
      setProgressPercent(s === "completed" ? 100 : 0);
    }
  }, [user?.username, module.id, module.status]);

  const ctaLabel =
    status === "not_started"
      ? "Start"
      : status === "completed"
        ? "Review"
        : "Resume";

  return (
    <article className="surface-card group overflow-hidden transition-all hover:border-zinc-300/90 hover:shadow-[var(--shadow-elevated)]">
      <div className="flex flex-col sm:flex-row">
        <div
          className={cn("w-full shrink-0 sm:w-1", statusAccent[status])}
          aria-hidden
        />
        <div className="flex flex-1 flex-col sm:flex-row sm:items-stretch">
          <div className="flex flex-1 gap-4 p-5 sm:p-6">
            <div className="icon-tile hidden h-11 w-11 sm:flex">
              <FileText className="h-5 w-5 text-zinc-500" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Mandatory
                </span>
                {module.contentType === "pdf" && (
                  <span className="text-[11px] text-zinc-400">· PDF</span>
                )}
              </div>
              <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-zinc-900 group-hover:text-[#2e3192]">
                {module.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 line-clamp-2">
                {module.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {module.slideCount} slides
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ~{module.durationMinutes} min
                </span>
              </div>
              <div className="mt-4 max-w-md">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Progress</span>
                  <span className="font-medium tabular-nums text-zinc-700">
                    {progressPercent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      status === "completed" ? "bg-emerald-500" : "bg-[#2e3192]",
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center border-t border-zinc-100 bg-zinc-50/60 px-5 py-4 sm:w-[148px] sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-4">
            <Link
              href={`/training/${module.id}`}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2e3192] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3d42a8]"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
