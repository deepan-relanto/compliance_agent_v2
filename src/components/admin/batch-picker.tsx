"use client";

import type { BatchInfo } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function mapBatch(row: Record<string, unknown>): BatchInfo {
  return {
    id: row.id as string,
    label: row.label as string,
    description: (row.description as string) ?? "",
    memberCount: Number(row.member_count ?? row.memberCount ?? 0),
    compliance: Number(row.compliance ?? 0),
    passRate: Number(row.pass_rate ?? row.passRate ?? 0),
    failRate: Number(row.fail_rate ?? row.failRate ?? 0),
    activeSessions: Number(row.active_sessions ?? row.activeSessions ?? 0),
  };
}

export function BatchPicker() {
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.batches)) {
          setBatches(data.batches.map(mapBatch));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#2e3192]" />
        Loading batches…
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="surface-card px-6 py-14 text-center text-sm text-zinc-500">
        No batches found. Run <code className="font-mono text-zinc-700">npm run db:seed</code> to
        create them.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {batches.map((batch) => (
        <Link key={batch.id} href={`/admin/batch/${batch.id}`} className="group">
          <article className="surface-card flex h-full flex-col p-6 transition-all hover:border-zinc-300/90 hover:shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Training batch
                </p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-[#2e3192]">
                  {batch.label}
                </h3>
              </div>
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums",
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
                View
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
