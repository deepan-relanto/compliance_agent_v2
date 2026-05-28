"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { UnderConstruction } from "@/components/layout/under-construction";

export default function AdminUploadPage() {
  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Upload PDF"
        subtitle="Upload training decks and auto-generate checkpoint MCQs."
      >
        <UnderConstruction
          title="Upload PDF"
          description="PPT/PDF ingestion, slide conversion, and Gemini MCQ generation will be available here."
        />
      </AdminShell>
    </RouteGuard>
  );
}
