"use client";

import { ReuseContentPanel } from "@/components/admin/reuse-content-panel";
import { UploadPanel } from "@/components/admin/upload-panel";
import { cn } from "@/lib/utils";
import { RefreshCcw, UploadCloud } from "lucide-react";
import { useState } from "react";

type TabId = "upload" | "reuse";

const TABS: { id: TabId; label: string; icon: typeof UploadCloud }[] = [
  { id: "upload", label: "Upload new", icon: UploadCloud },
  { id: "reuse", label: "Reuse content", icon: RefreshCcw },
];

export function ContentLibraryHub() {
  const [tab, setTab] = useState<TabId>("upload");

  return (
    <div className="space-y-8">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-white text-[#2e3192] shadow-sm ring-1 ring-zinc-200/80"
                  : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900",
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
    </div>
  );
}
