"use client";

import { AiReportPanel } from "@/components/admin/ai-report-panel";
import { BatchPassChart } from "@/components/admin/batch-pass-chart";
import { BatchTable } from "@/components/admin/batch-table";
import { LiveControlPanel } from "@/components/admin/live-control-panel";
import { MetricCard } from "@/components/admin/metric-card";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import {
  getAiReportForBatch,
  getBatchById,
  getProgressForBatch,
} from "@/lib/mock-data";
import {
  Activity,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Users,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = typeof params.batchId === "string" ? params.batchId : "";
  const batch = getBatchById(batchId);
  const progress = getProgressForBatch(batchId);

  useEffect(() => {
    if (!batch) router.replace("/admin/batches");
  }, [batch, router]);

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
            <BatchTable rows={progress} />
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
