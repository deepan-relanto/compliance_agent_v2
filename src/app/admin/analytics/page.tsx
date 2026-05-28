"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { UnderConstruction } from "@/components/layout/under-construction";

export default function AdminAnalyticsPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Analytics"
        subtitle="Organization-wide trends, exports, and historical compliance data."
      >
        <UnderConstruction
          title="Analytics"
          description="Cross-batch dashboards, time-series charts, and PDF/CSV export hub coming soon."
        />
      </AdminShell>
    </RouteGuard>
  );
}
