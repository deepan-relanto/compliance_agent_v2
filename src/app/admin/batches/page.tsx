"use client";

import { BatchPicker } from "@/components/admin/batch-picker";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminBatchesPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Batches"
        subtitle="Choose a batch to see detailed compliance, learners, and controls."
      >
        <BatchPicker />
      </AdminShell>
    </RouteGuard>
  );
}
