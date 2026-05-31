"use client";

import { AiReportPanel } from "@/components/admin/ai-report-panel";
import { BatchPassChart } from "@/components/admin/batch-pass-chart";
import { BatchTable } from "@/components/admin/batch-table";
import { LiveControlPanel } from "@/components/admin/live-control-panel";
import { MetricCard } from "@/components/admin/metric-card";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { getAiReportForBatch, type BatchInfo } from "@/lib/mock-data";
import { getProgressForBatchLive } from "@/lib/progress-store";
import type { EmployeeProgress } from "@/lib/types";
import {
  Activity,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function toEmployeeRows(
  records: ReturnType<typeof getProgressForBatchLive>,
): EmployeeProgress[] {
  return records.map((p) => ({
    username: p.username,
    batchId: p.batchId,
    moduleId: p.moduleId,
    moduleTitle: p.moduleTitle,
    progressPercent:
      p.totalSlides > 0
        ? Math.round(((p.currentSlide + 1) / p.totalSlides) * 100)
        : 0,
    mcqPassRate: 0,
    timeSpentMinutes: 0,
    status: p.status,
  }));
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = typeof params.batchId === "string" ? params.batchId : "";
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressTick, setProgressTick] = useState(0);

  useEffect(() => {
    if (!batchId) return;
    fetch(`/api/batches/${encodeURIComponent(batchId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.batch) {
          setBatch(mapBatch(data.batch));
        } else {
          setBatch(null);
        }
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    if (!loading && !batch) router.replace("/admin/batches");
  }, [loading, batch, router]);

  const progress = useMemo(() => {
    void progressTick;
    return toEmployeeRows(getProgressForBatchLive(batchId));
  }, [batchId, progressTick]);

  useEffect(() => {
    const id = window.setInterval(() => setProgressTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin text-[#2e3192]" />
        Loading batch…
      </div>
    );
  }

  if (!batch) return null;

  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title={batch.label}
        subtitle={batch.description}
        backHref="/admin/batches"
        backLabel="All batches"
      >
        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Export PDF
          </Button>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Batch compliance"
            value={batch.compliance}
            suffix="%"
            icon={CheckCircle2}
            accent="success"
          />
          <MetricCard
            label="Active sessions"
            value={batch.activeSessions}
            icon={Activity}
            accent="accent"
            trend="Learners in training now"
          />
          <MetricCard
            label="MCQ pass rate"
            value={batch.passRate}
            suffix="%"
            icon={Users}
            accent="brand"
          />
          <MetricCard
            label="MCQ fail rate"
            value={batch.failRate}
            suffix="%"
            icon={XCircle}
            accent="danger"
          />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <BatchPassChart
              label={batch.label}
              pass={batch.passRate}
              fail={batch.failRate}
              compliance={batch.compliance}
            />
            <BatchTable
              rows={progress}
              title={
                progress.length === 0
                  ? "Learner progress (no sessions yet)"
                  : "Learner progress"
              }
            />
          </div>
          <div className="space-y-5">
            <LiveControlPanel />
            <AiReportPanel content={getAiReportForBatch(batchId)} />
          </div>
        </section>
      </AdminShell>
    </RouteGuard>
  );
}
