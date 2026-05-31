"use client";

import { MetricCard } from "@/components/admin/metric-card";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import type { BatchInfo } from "@/lib/mock-data";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Layers3,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
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

const quickLinks = [
  {
    href: "/admin/batches",
    label: "Batch Management",
    title: "Open batch view",
    description:
      "Drill down into each batch for pass/fail trends, live controls, and insights.",
    icon: Layers3,
  },
  {
    href: "/admin/upload",
    label: "Content Pipeline",
    title: "Upload PDF / PPT",
    description:
      "Convert decks to PDF, assign batches, and publish checkpoint MCQs.",
    icon: Upload,
  },
  {
    href: "/admin/monitoring",
    label: "Integrity Monitoring",
    title: "Assessment Monitoring",
    description:
      "Track warning logs, focus events, and automatic session failures.",
    icon: ShieldAlert,
  },
  {
    href: "/admin/feedback",
    label: "Learner Feedback",
    title: "View all feedback",
    description:
      "Read feedback submitted by learners after completing assessments.",
    icon: MessageSquare,
  },
];

export default function AdminPage() {
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

  const totalLearners = batches.reduce((acc, b) => acc + b.memberCount, 0);
  const activeSessions = batches.reduce((acc, b) => acc + b.activeSessions, 0);
  const avgCompliance =
    batches.length > 0
      ? Math.round(batches.reduce((acc, b) => acc + b.compliance, 0) / batches.length)
      : 0;

  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Dashboard"
        subtitle="Organization overview, training health, and quick actions."
      >
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#2e3192]" />
            Loading metrics…
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Avg. compliance"
              value={avgCompliance}
              suffix="%"
              icon={CheckCircle2}
              accent="success"
              trend="Across all batches"
            />
            <MetricCard
              label="Active sessions"
              value={activeSessions}
              icon={Activity}
              accent="accent"
              trend="Learners currently active"
            />
            <MetricCard
              label="Batches"
              value={batches.length}
              icon={Layers3}
              accent="brand"
            />
            <MetricCard
              label="Total learners"
              value={totalLearners}
              icon={Users}
              accent="muted"
            />
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="surface-card group flex flex-col p-5 transition-all hover:border-zinc-300/90 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="icon-tile-brand">
                  <link.icon className="h-4 w-4 text-[#2e3192]" strokeWidth={1.75} />
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-[#2e3192]" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {link.label}
              </p>
              <h3 className="mt-1 text-base font-semibold text-zinc-900 group-hover:text-[#2e3192]">
                {link.title}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-zinc-500">
                {link.description}
              </p>
            </Link>
          ))}
        </section>

        <Link
          href="/admin/analytics"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-[#2e3192]"
        >
          <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
          Analytics (coming soon)
        </Link>
      </AdminShell>
    </RouteGuard>
  );
}
