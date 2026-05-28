"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { ModuleCard } from "@/components/employee/module-card";
import { EmployeeShell } from "@/components/layout/employee-shell";
import { useAuthStore } from "@/lib/auth-store";
import { getModulesForBatch } from "@/lib/mock-data";
import { BookOpen, CheckCircle2, Clock3 } from "lucide-react";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const modules = user?.batchId ? getModulesForBatch(user.batchId) : [];
  const completedCount = modules.filter((m) => m.status === "completed").length;
  const inProgressCount = modules.filter((m) => m.status === "in_progress").length;
  const totalMinutes = modules.reduce((acc, m) => acc + m.durationMinutes, 0);

  return (
    <RouteGuard allowedRoles={["user"]}>
      <EmployeeShell
        title="My training"
        subtitle="Complete all mandatory modules assigned to your batch."
      >
        <div className="mb-6 rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Welcome back
          </p>
          <p className="mt-1 text-[15px] text-zinc-700">
            Batch:{" "}
            <span className="font-medium text-zinc-900">
              {user?.batchId?.replace("_", " ").toUpperCase()}
            </span>
          </p>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Assigned modules</p>
              <BookOpen className="h-4 w-4 text-[#2e3192]" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
              {modules.length}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">In progress</p>
              <Clock3 className="h-4 w-4 text-[#f15a24]" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
              {inProgressCount}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Completed</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
              {completedCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">~{totalMinutes} min total</p>
          </div>
        </section>

        <div className="space-y-4">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </EmployeeShell>
    </RouteGuard>
  );
}
