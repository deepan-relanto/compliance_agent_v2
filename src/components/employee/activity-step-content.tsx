"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isActivityCompletePayload,
  type ActivityCompletePayload,
} from "@/lib/activity-embed";
import { Loader2, FlaskConical, CheckCircle2 } from "lucide-react";

interface ActivityStepContentProps {
  /** Public URL of the activity HTML (from step.config.assetUrl) */
  assetUrl: string;
  /** Human-readable name shown in the chrome bar (from step.config.originalName) */
  label?: string;
  /** Called once when the activity iframe sends ACTIVITY_COMPLETE */
  onComplete: (payload: ActivityCompletePayload) => void;
  /** True when the learner already finished this step in a prior session */
  alreadyCompleted?: boolean;
  /** Score from a prior completion — shown on the "already done" card */
  priorScore?: number;
  /** Max score (default 100) */
  priorMaxScore?: number;
}

/**
 * Generic activity iframe wrapper.
 *
 * Used for any step_type="activity" step in any course.
 * The HTML file at `assetUrl` just needs to fire:
 *   window.parent.postMessage({ type:'ACTIVITY_COMPLETE', source:'prompt-lab', score, maxScore }, '*')
 *
 * To embed a new activity lab for a different course in the future:
 *   → Upload or place the HTML in /public/activity/
 *   → Create a course step with step_type="activity" and config.assetUrl pointing to it
 *   → No code changes required
 */
export function ActivityStepContent({
  assetUrl,
  label = "Prompt Engineering Lab",
  onComplete,
  alreadyCompleted = false,
  priorScore,
  priorMaxScore = 100,
}: ActivityStepContentProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(alreadyCompleted);
  const [completedPayload, setCompletedPayload] =
    useState<ActivityCompletePayload | null>(null);

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      // Security: verify the message came from our iframe
      if (
        iframeRef.current &&
        ev.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      if (!isActivityCompletePayload(ev.data)) return;
      setDone(true);
      setCompletedPayload(ev.data);
      onComplete(ev.data);
    },
    [onComplete],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const displayScore = completedPayload?.score ?? priorScore;
  const displayMax = completedPayload?.maxScore ?? priorMaxScore;

  /* ── Already-done card ── */
  if (done) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,96vw)] flex-col overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-2xl">
        {/* Chrome bar — matches other step types */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
          <FlaskConical className="h-4 w-4 text-[#f15a24]" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
            Prompt Engineering Activity
          </p>
          <span className="truncate text-xs text-zinc-400">{label}</span>
        </div>

        {/* Completion body */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Activity Complete!
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              You&apos;ve successfully finished{" "}
              <strong className="text-zinc-200">{label}</strong>.
            </p>
          </div>
          {displayScore !== undefined && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-10 py-4">
              <p className="text-3xl font-black tracking-tight text-white">
                {displayScore}
                <span className="text-base font-medium text-zinc-400">
                  {" "}/ {displayMax}
                </span>
              </p>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Mastery Points
              </p>
            </div>
          )}
          <p className="text-xs text-zinc-600">
            Click{" "}
            <span className="font-semibold text-zinc-400">Next</span> in
            the sidebar to continue your course.
          </p>
        </div>
      </div>
    );
  }

  /* ── Live activity iframe ── */
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,96vw)] flex-col overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-2xl">
      {/* Chrome bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <FlaskConical className="h-4 w-4 text-[#f15a24]" />
        <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
          Prompt Engineering Activity
        </p>
        <span className="truncate text-xs text-zinc-400">{label}</span>
      </div>

      {/* iframe */}
      <div className="relative min-h-0 flex-1 bg-[#ECEEF6]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950">
            <Loader2 className="h-8 w-8 animate-spin text-[#2e3192]" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={assetUrl}
          src={assetUrl}
          title={label}
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
