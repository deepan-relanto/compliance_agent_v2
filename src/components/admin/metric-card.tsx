import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  accent?: "brand" | "accent" | "success" | "danger" | "muted";
}

const accentMap = {
  brand: "text-[#2e3192]",
  accent: "text-[#f15a24]",
  success: "text-emerald-600",
  danger: "text-red-600",
  muted: "text-zinc-400",
};

export function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  trend,
  className,
  accent = "muted",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-md border border-zinc-200/90 bg-white p-5 shadow-[var(--shadow-card)] min-h-[120px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <Icon className={cn("h-4 w-4 shrink-0", accentMap[accent])} strokeWidth={1.5} />
      </div>
      <div className="mt-4">
        <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">
          {value}
          {suffix && (
            <span className="ml-0.5 text-base font-medium text-zinc-400">{suffix}</span>
          )}
        </p>
        {trend && <p className="mt-1 text-xs text-zinc-500">{trend}</p>}
      </div>
    </div>
  );
}
