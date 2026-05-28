"use client";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainingModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, Layers, Play } from "lucide-react";
import Link from "next/link";

interface ModuleCardProps {
  module: TrainingModule;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const progress =
    module.status === "completed"
      ? 100
      : module.status === "in_progress"
        ? 42
        : 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          <div className="flex-1 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={module.status} />
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
                <span className="font-medium text-zinc-700">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-md bg-zinc-100">
                <div
                  className={cn(
                    "h-full rounded-md",
                    module.status === "completed" ? "bg-emerald-500" : "bg-[#2e3192]",
                  )}
                  style={{ width: `${progress}%` }}
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
              {module.status === "not_started" ? "Start" : "Resume"}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
