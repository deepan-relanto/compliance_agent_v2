/**
 * activity-embed.ts
 *
 * Generic postMessage contract between any activity HTML iframe
 * and the CoursePlayer host.
 *
 * ── How to add a new activity for a DIFFERENT module ──────────────────
 * 1. Create your HTML file (e.g. /public/activity/data-literacy.html)
 * 2. Add this bridge at the end of the HTML before </body>:
 *
 *    window.parent.postMessage({
 *      type: 'ACTIVITY_COMPLETE',
 *      source: 'prompt-lab',   <-- keep this value for now
 *      score: <number 0-100>,
 *      maxScore: 100
 *    }, '*');
 *
 * 3. In the Admin course builder:
 *    - Add a step with step_type = "activity"
 *    - Set config.assetUrl = "/activity/data-literacy.html"
 *    - Set config.originalName = "Data Literacy Lab"
 *
 * That's it. No code changes needed — the ActivityStepContent
 * component reads assetUrl from config, just like pdf/scenarios steps.
 * ─────────────────────────────────────────────────────────────────────
 */

export const ACTIVITY_EMBED_EVENT = "ACTIVITY_COMPLETE" as const;
export const ACTIVITY_EMBED_SOURCE = "prompt-lab" as const;

/** Shape of the postMessage payload from any activity iframe */
export interface ActivityCompletePayload {
  type: typeof ACTIVITY_EMBED_EVENT;
  source: typeof ACTIVITY_EMBED_SOURCE;
  score: number;
  maxScore: number;
}

export function isActivityCompletePayload(
  data: unknown,
): data is ActivityCompletePayload {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as ActivityCompletePayload).type === ACTIVITY_EMBED_EVENT &&
    (data as ActivityCompletePayload).source === ACTIVITY_EMBED_SOURCE &&
    typeof (data as ActivityCompletePayload).score === "number"
  );
}
