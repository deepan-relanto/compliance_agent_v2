/** Placeholder AI insight copy per batch until Gemini reports are wired. */
export function getAiReportForBatch(batchId: string): string {
  if (batchId === "batch_a") {
    return `## Batch A — Engineering

**Overall compliance** is tracked from live learner sessions. Upload assessments and assign them to this batch to begin collecting data.

**Recommended:** Review integrity warnings in Monitoring after the first assessment week.`;
  }
  if (batchId === "batch_b") {
    return `## Batch B — Operations

**Field teams** often complete training on shared devices — remind learners to stay in fullscreen during proctored sessions.

**Recommended:** Use Live Control when multiple active sessions appear on the monitoring dashboard.`;
  }
  return `## Batch C — Sales

**Customer-facing teams** — keep modules short and scenario-based at each checkpoint.

**Recommended:** Export progress CSV before quarterly compliance reviews.`;
}
