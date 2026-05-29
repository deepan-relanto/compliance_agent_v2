"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { UploadPanel } from "@/components/admin/upload-panel";

export default function AdminUploadPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Upload PDF"
        subtitle="Upload training decks and auto-generate checkpoint MCQs."
      >
        <UploadPanel />
      </AdminShell>
    </RouteGuard>
  );
}
