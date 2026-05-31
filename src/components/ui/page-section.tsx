import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageSection({
  title,
  description,
  action,
  children,
  className,
}: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
