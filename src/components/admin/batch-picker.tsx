"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BATCHES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";

export function BatchPicker() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {BATCHES.map((batch) => (
        <Link key={batch.id} href={`/admin/batch/${batch.id}`} className="group">
          <Card className="h-full transition-all hover:border-[#2e3192]/30 hover:shadow-[var(--shadow-elevated)]">
            <CardContent className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Training batch
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-[#2e3192]">
                    {batch.label}
                  </h3>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-lg font-semibold tabular-nums",
                    batch.compliance >= 70
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-orange-50 text-[#c2410c]",
                  )}
                >
                  {batch.compliance}%
                </span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-500">
                {batch.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {batch.memberCount} learners · {batch.activeSessions} active
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[#2e3192] opacity-0 transition-opacity group-hover:opacity-100">
                  View details
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
