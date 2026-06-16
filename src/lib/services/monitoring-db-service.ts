import type { getSql } from "@/lib/db";
import type {
  AssessmentAcknowledgement,
  AssessmentProgress,
  AuditLogEntry,
  ReviewRequest,
} from "@/lib/types";

type Sql = ReturnType<typeof getSql>;

function parseJson<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function toMs(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/** DB row may predate acknowledgement sync — infer from completion when attestation missing. */
function resolveAcknowledgement(row: Record<string, unknown>): AssessmentAcknowledgement | undefined {
  const parsed = parseJson<AssessmentAcknowledgement | undefined>(
    row.acknowledgement,
    undefined,
  );
  if (parsed?.accepted) return parsed;

  if (row.status === "completed" && row.completed_at) {
    return {
      userId: String(row.user_email),
      userName: String(row.user_email),
      assessmentId: String(row.module_id),
      assessmentName: String(row.module_title),
      accepted: true,
      timestamp: toMs(row.completed_at) ?? Date.now(),
    };
  }

  return parsed;
}

export interface MonitoringSummary {
  activeAssessments: number;
  usersWithWarnings: number;
  totalWarnings: number;
  failedAssessments: number;
  permanentlyFailedCount: number;
  pendingReviewsCount: number;
}

/** Lightweight summary query for KPI cards — no full row scans of all progress fields. */
export async function getMonitoringSummary(sql: Sql): Promise<MonitoringSummary> {
  const [progressRows, reviewRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS active_assessments,
        COUNT(*) FILTER (WHERE warning_count > 0)::int AS users_with_warnings,
        COALESCE(SUM(warning_count), 0)::int AS total_warnings,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_assessments,
        COUNT(*) FILTER (WHERE status = 'permanently_failed')::int AS permanently_failed
      FROM assessment_progress
    `,
    sql`
      SELECT COUNT(*)::int AS pending FROM review_requests WHERE status = 'Pending'
    `,
  ]);
  const p = progressRows[0] ?? {};
  const r = reviewRows[0] ?? {};
  return {
    activeAssessments: Number(p.active_assessments ?? 0),
    usersWithWarnings: Number(p.users_with_warnings ?? 0),
    totalWarnings: Number(p.total_warnings ?? 0),
    failedAssessments: Number(p.failed_assessments ?? 0),
    permanentlyFailedCount: Number(p.permanently_failed ?? 0),
    pendingReviewsCount: Number(r.pending ?? 0),
  };
}

export interface PaginatedViolations {
  records: AssessmentProgress[];
  total: number;
}

/** Paginated violations (sorted by warning_count DESC, last_accessed_at DESC). */
export async function listMonitoringViolationsPaged(
  sql: Sql,
  page: number,
  pageSize: number,
): Promise<PaginatedViolations> {
  const offset = (page - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM assessment_progress`,
    sql`
      SELECT
        user_email, module_id, module_title, batch_id,
        current_slide, total_slides, status,
        warning_count, warning_history, archived_warnings,
        retake_count, failed_at, failed_reason,
        last_failure_at, last_failure_reason,
        acknowledgement, mcq_correct, mcq_total, score_percent,
        last_accessed_at, completed_at
      FROM assessment_progress
      ORDER BY warning_count DESC, last_accessed_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const records: AssessmentProgress[] = rows.map((r) => ({
    username: r.user_email as string,
    moduleId: r.module_id as string,
    moduleTitle: r.module_title as string,
    batchId: r.batch_id as string,
    currentSlide: Number(r.current_slide ?? 0),
    totalSlides: Number(r.total_slides ?? 1),
    status: r.status as AssessmentProgress["status"],
    lastAccessedAt: toMs(r.last_accessed_at) ?? Date.now(),
    completedAt: toMs(r.completed_at),
    warningCount: Number(r.warning_count ?? 0),
    warningHistory: parseJson(r.warning_history, []),
    failedAt: toMs(r.failed_at),
    failedReason: (r.failed_reason as string) ?? undefined,
    retakeCount: Number(r.retake_count ?? 0),
    lastFailureAt: toMs(r.last_failure_at),
    lastFailureReason: (r.last_failure_reason as string) ?? undefined,
    archivedWarnings: parseJson(r.archived_warnings, []),
    acknowledgement: resolveAcknowledgement(r),
    mcqCorrect: Number(r.mcq_correct ?? 0),
    mcqTotal: Number(r.mcq_total ?? 0),
    scorePercent: r.score_percent != null ? Number(r.score_percent) : null,
  }));

  return { records, total: Number(countRows[0]?.total ?? 0) };
}

export interface PaginatedReviews {
  reviews: ReviewRequest[];
  total: number;
}

/** Paginated review requests. */
export async function listMonitoringReviewsPaged(
  sql: Sql,
  page: number,
  pageSize: number,
): Promise<PaginatedReviews> {
  const offset = (page - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM review_requests`,
    sql`
      SELECT *
      FROM review_requests
      ORDER BY submitted_timestamp DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const reviews: ReviewRequest[] = rows.map((r) => ({
    id: r.id as string,
    username: r.username as string,
    moduleId: r.module_id as string,
    moduleTitle: r.module_title as string,
    warningCount: Number(r.warning_count ?? 0),
    failureTimestamp: Number(r.failure_timestamp),
    userExplanation: r.user_explanation as string,
    status: r.status as ReviewRequest["status"],
    submittedTimestamp: Number(r.submitted_timestamp),
    decisionTimestamp: r.decision_timestamp != null ? Number(r.decision_timestamp) : undefined,
    approvedBy: (r.approved_by as string) ?? undefined,
    approvedAt: r.approved_at != null ? Number(r.approved_at) : undefined,
    rejectedBy: (r.rejected_by as string) ?? undefined,
    rejectedAt: r.rejected_at != null ? Number(r.rejected_at) : undefined,
    adminComment: (r.admin_comment as string) ?? undefined,
  }));

  return { reviews, total: Number(countRows[0]?.total ?? 0) };
}

export interface PaginatedAuditLogs {
  auditLogs: AuditLogEntry[];
  total: number;
}

/** Paginated audit logs. */
export async function listMonitoringAuditLogsPaged(
  sql: Sql,
  page: number,
  pageSize: number,
): Promise<PaginatedAuditLogs> {
  const offset = (page - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM audit_logs`,
    sql`
      SELECT id, action, actor, details, timestamp
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const auditLogs: AuditLogEntry[] = rows.map((r) => ({
    id: r.id as string,
    action: r.action as string,
    admin: r.actor as string,
    timestamp: Number(r.timestamp),
    details: (r.details as string) ?? undefined,
  }));

  return { auditLogs, total: Number(countRows[0]?.total ?? 0) };
}

// ── Legacy (full payload) ─────────────────────────────────────────────────────

export async function listMonitoringProgress(sql: Sql): Promise<AssessmentProgress[]> {
  const { records } = await listMonitoringViolationsPaged(sql, 1, 1000);
  return records;
}

export async function listMonitoringReviews(sql: Sql): Promise<ReviewRequest[]> {
  const { reviews } = await listMonitoringReviewsPaged(sql, 1, 1000);
  return reviews;
}

export async function listMonitoringAuditLogs(sql: Sql): Promise<AuditLogEntry[]> {
  const { auditLogs } = await listMonitoringAuditLogsPaged(sql, 1, 1000);
  return auditLogs;
}

export async function getMonitoringPayload(sql: Sql) {
  const [records, reviews, auditLogs] = await Promise.all([
    listMonitoringProgress(sql),
    listMonitoringReviews(sql),
    listMonitoringAuditLogs(sql),
  ]);
  return { records, reviews, auditLogs };
}
