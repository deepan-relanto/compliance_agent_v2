"use client";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth-store";
import { getProgress, getModuleStatus } from "@/lib/progress-store";
import type { TrainingModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, Layers, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ModuleStatus } from "@/lib/types";

interface ModuleCardProps {
  module: TrainingModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const user = useAuthStore((s) => s.user);

  // Read real progress from localStorage (client-side only)
  const [status, setStatus] = useState<ModuleStatus>(module.status);
  const [progressPercent, setProgressPercent] = useState(
    module.status === "completed" ? 100 : module.status === "in_progress" ? 42 : 0,
  );

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
      // Fall back to the status baked into the module object (demo modules)
      const s = getModuleStatus(user.username, module.id);
      setStatus(s);
      setProgressPercent(s === "completed" ? 100 : s === "in_progress" ? 42 : 0);
    }
  }, [user?.username, module.id]);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          <div className="flex-1 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs font-medium text-zinc-400">Mandatory</span>
            </div>
            <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-900">
              {module.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 line-clamp-2">
              {module.description}
            </p>
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
                {module.slideCount} slides
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                ~{module.durationMinutes} min
              </span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Progress</span>
                <span className="font-medium text-zinc-700">{progressPercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-md bg-zinc-100">
                <div
                  className={cn(
                    "h-full rounded-md transition-all duration-500",
                    status === "completed" ? "bg-emerald-500" : "bg-[#2e3192]",
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center border-t border-zinc-100 bg-zinc-50/50 p-4 sm:w-36 sm:border-l sm:border-t-0">
            <Link
              href={`/training/${module.id}`}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#2e3192] px-4 text-sm font-medium text-white hover:bg-[#3d42a8]"
            >
              <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
              {status === "not_started" ? "Start" : status === "completed" ? "Review" : "Resume"}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
