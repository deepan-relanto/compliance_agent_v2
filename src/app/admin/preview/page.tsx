"use client";

import { AdminShell } from "@/components/layout/admin-shell";
import { RouteGuard } from "@/components/auth/route-guard";
import { useAuthStore } from "@/lib/auth-store";
import { FlaskConical, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

interface CourseModule {
  id: string;
  title: string;
  stepCount: number;
  mcqCount: number;
  canReuse: boolean;
}

export default function PreviewPage() {
  const user = useAuthStore((s) => s.user);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content/course-library");
      const data = await res.json();
      if (data.ok && Array.isArray(data.library)) {
        // Show all modules, not just canReuse, so you can test incomplete ones too
        setModules(data.library);
        if (data.library.length > 0 && !selectedId) {
          setSelectedId((data.library[0] as CourseModule).id);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreview = () => {
    if (!selectedId) return;
    // Open the training player exactly as a learner would see it.
    // fresh=1 starts from slide 0; preview=1 flags simulation mode so no progress is written.
    const url = `/training/${encodeURIComponent(selectedId)}?fresh=1&preview=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const selected = modules.find((m) => m.id === selectedId);

  return (
    <RouteGuard allowedRoles={["admin"]}>
      <AdminShell
        title="Preview course"
        subtitle="Simulate exactly what learners see — no progress is saved."
      >
        <div className="mx-auto max-w-xl space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-[#2e3192]/20 bg-[#2e3192]/5 px-4 py-3">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-[#2e3192]" />
            <p className="text-sm text-zinc-700">
              Opens the full course player in a new tab. Scores and progress will{" "}
              <span className="font-semibold">not</span> be recorded.
              Use this to verify content, activities, and the quiz flow before assigning to learners.
            </p>
          </div>

          {/* Module picker */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-800">Select a module</h2>
              <button
                onClick={() => void load()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-40"
                title="Refresh list"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#2e3192]" />
                </div>
              ) : modules.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No course modules found.</p>
              ) : (
                <div className="space-y-2">
                  {modules.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        selectedId === m.id
                          ? "border-[#2e3192]/40 bg-[#2e3192]/5"
                          : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="module"
                        value={m.id}
                        checked={selectedId === m.id}
                        onChange={() => setSelectedId(m.id)}
                        className="mt-0.5 h-4 w-4 accent-[#2e3192]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800">{m.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {m.stepCount} step{m.stepCount !== 1 ? "s" : ""} ·{" "}
                          {m.mcqCount} question{m.mcqCount !== 1 ? "s" : ""}
                          {!m.canReuse && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                              incomplete
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview button */}
          {selected && (
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-800">{selected.title}</p>
                <p className="text-xs text-zinc-500">
                  Signed in as{" "}
                  <span className="font-medium">{user?.displayName ?? user?.username}</span>
                </p>
              </div>
              <button
                id="admin-preview-launch-btn"
                onClick={handlePreview}
                disabled={!selectedId}
                className="ml-4 flex shrink-0 items-center gap-2 rounded-lg bg-[#2e3192] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#4346A9] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ExternalLink className="h-4 w-4" />
                Open preview
              </button>
            </div>
          )}
        </div>
      </AdminShell>
    </RouteGuard>
  );
}
