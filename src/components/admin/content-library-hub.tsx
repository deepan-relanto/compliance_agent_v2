"use client";

import { ReuseContentPanel } from "@/components/admin/reuse-content-panel";
import { ScoresPanel } from "@/components/admin/scores-panel";
import { UploadPanel } from "@/components/admin/upload-panel";
import { cn } from "@/lib/utils";
import { BarChart3, RefreshCcw, UploadCloud } from "lucide-react";
import { useState } from "react";

type TabId = "upload" | "reuse" | "scores";

const TABS: { id: TabId; label: string; icon: typeof UploadCloud }[] = [
  { id: "upload", label: "Upload new", icon: UploadCloud },
  { id: "reuse", label: "Reuse content", icon: RefreshCcw },
  { id: "scores", label: "Learner scores", icon: BarChart3 },
];

export function ContentLibraryHub() {
  const [tab, setTab] = useState<TabId>("upload");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-[#2e3192] shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900",
              )}
            >
              <t.icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "upload" && <UploadPanel />}
      {tab === "reuse" && <ReuseContentPanel />}
      {tab === "scores" && <ScoresPanel />}
    </div>
  );
}
