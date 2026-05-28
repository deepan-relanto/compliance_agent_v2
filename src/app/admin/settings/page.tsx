"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { UnderConstruction } from "@/components/layout/under-construction";

export default function AdminSettingsPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Settings"
        subtitle="Organization preferences, batch configuration, and integrations."
      >
        <UnderConstruction
          title="Settings"
          description="User roles, SSO, notification rules, and API keys will be configured here."
        />
      </AdminShell>
    </RouteGuard>
  );
}
