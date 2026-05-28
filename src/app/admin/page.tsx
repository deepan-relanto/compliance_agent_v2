"use client";

import { MetricCard } from "@/components/admin/metric-card";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { ADMIN_METRICS, BATCHES } from "@/lib/mock-data";
import { Activity, CheckCircle2, Layers3, Users } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Dashboard"
        subtitle="Organization overview, active training health, and quick actions."
      >
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total compliance"
            value={ADMIN_METRICS.totalCompliance}
            suffix="%"
            icon={CheckCircle2}
            accent="success"
            trend="+6% versus last quarter"
          />
          <MetricCard
            label="Active sessions"
            value={ADMIN_METRICS.activeSessions}
            icon={Activity}
            accent="accent"
            trend="Learners currently active"
          />
          <MetricCard
            label="Batches"
            value={BATCHES.length}
            icon={Layers3}
            accent="brand"
          />
          <MetricCard
            label="Total learners"
            value={BATCHES.reduce((acc, b) => acc + b.memberCount, 0)}
            icon={Users}
            accent="muted"
          />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/batches"
            className="rounded-md border border-zinc-200 bg-white p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[#2e3192]/40"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Batch Management
            </p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900">
              Open batch command view
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Drill down into each batch for pass/fail trends, live controls, and AI insights.
            </p>
          </Link>
          <Link
            href="/admin/upload"
            className="rounded-md border border-zinc-200 bg-white p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[#2e3192]/40"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Content Pipeline
            </p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900">
              Upload PDF / PPT
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Prepare modules, generate checkpoint MCQs, and publish to selected batches.
            </p>
          </Link>
        </section>
      </AdminShell>
    </RouteGuard>
  );
}
