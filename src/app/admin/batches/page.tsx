"use client";

import { BatchPicker } from "@/components/admin/batch-picker";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Construction, Plus } from "lucide-react";
import { useState } from "react";

export default function AdminBatchesPage() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Batches"
        subtitle="View batch rosters. Scores, progress, and exports are in Analytics."
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {showComingSoon
              ? "Batch creation will be enabled once master HR records are connected."
              : "Open a batch to see its members. Use Analytics for scores and progress."}
          </p>
          <Button
            size="sm"
            onClick={() => setShowComingSoon((v) => !v)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create batch
          </Button>
        </div>

        {showComingSoon && (
          <div className="surface-card mb-6 flex items-start gap-3 border-amber-200/70 bg-amber-50/40 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Construction className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Batch creation — under construction
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
                Once the master HR database is connected, you&apos;ll be able to define
                batches, assign learners, and manage memberships from this page.
                For now, batches are seeded from the configuration.
              </p>
              <button
                type="button"
                onClick={() => setShowComingSoon(false)}
                className="mt-2 text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        <BatchPicker />
      </AdminShell>
    </RouteGuard>
  );
}
