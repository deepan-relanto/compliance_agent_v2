"use client";

import { FeedbackTable } from "@/components/admin/feedback-table";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";

export default function AdminFeedbackPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Feedback"
        subtitle="All assessment feedback submitted by learners, newest first."
      >
        <FeedbackTable />
      </AdminShell>
    </RouteGuard>
  );
}
