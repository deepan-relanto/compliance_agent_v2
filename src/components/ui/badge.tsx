import { cn } from "@/lib/utils";
import type { ModuleStatus } from "@/lib/types";

const statusStyles: Record<ModuleStatus, string> = {
  not_started: "bg-zinc-100 text-zinc-600 border-zinc-200",
  in_progress: "bg-orange-50 text-[#c2410c] border-orange-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusLabels: Record<ModuleStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export function StatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
