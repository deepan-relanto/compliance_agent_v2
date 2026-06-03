"use client";

import { BatchMembersList, type BatchMember } from "@/components/admin/batch-members-list";
import { RouteGuard } from "@/components/auth/route-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BatchMeta {
  id: string;
  label: string;
  description: string;
  memberCount: number;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = typeof params.batchId === "string" ? params.batchId : "";
  const [batch, setBatch] = useState<BatchMeta | null>(null);
  const [members, setMembers] = useState<BatchMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!batchId) return;
    fetch(`/api/batches/${encodeURIComponent(batchId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.batch) {
          setBatch({
            id: data.batch.id,
            label: data.batch.label,
            description: data.batch.description ?? "",
            memberCount: Number(data.batch.memberCount ?? 0),
          });
          setMembers(Array.isArray(data.users) ? data.users : []);
        } else {
          setBatch(null);
        }
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    if (!loading && !batch) router.replace("/admin/batches");
  }, [loading, batch, router]);

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
        subtitle={batch.description || "Learners assigned to this training batch."}
        backHref="/admin/batches"
        backLabel="All batches"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm">
            <Users className="h-3.5 w-3.5 text-[#2e3192]" />
            {members.length} member{members.length !== 1 ? "s" : ""}
          </div>
          <Link href={`/admin/analytics/batch/${encodeURIComponent(batchId)}`}>
            <Button variant="outline" size="sm">
              <BarChart3 className="h-3.5 w-3.5" />
              View marks & export
            </Button>
          </Link>
        </div>

        <BatchMembersList
          members={members}
          batchLabel={batch.label}
          analyticsHref={`/admin/analytics/batch/${encodeURIComponent(batchId)}`}
        />
      </AdminShell>
    </RouteGuard>
  );
}
