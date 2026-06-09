import type { getSql } from "@/lib/db";
import { PASS_THRESHOLD_PERCENT, isPassingScore } from "@/lib/constants";

type Sql = ReturnType<typeof getSql>;

export type ProgressRow = {
  user_email: string;
  module_id: string;
  module_title: string;
  batch_id: string;
  current_slide: number;
  total_slides: number;
  status: string;
  warning_count: number;
  retake_count: number;
  mcq_correct: number;
  mcq_total: number;
  score_percent: number | null;
  mcq_answers: Record<string, boolean>;
  failed_reason: string | null;
  completed_at: string | null;
};

/** Learner-facing / admin display status — never show "not started" when a score exists. */
export function normalizeProgressStatus(
  status: string | null | undefined,
  scorePercent: number | null,
  completedAt?: string | null,
): string {
  const s = status ?? "not_started";
  if (s === "permanently_failed") return s;
  if (s === "completed" || completedAt) return "completed";
  if (isPassingScore(scorePercent)) {
    return "completed";
  }
  if (s === "failed" && scorePercent != null) return "in_progress";
  if (scorePercent != null && s === "not_started") return "in_progress";
  if (s === "in_progress" || s === "failed") return s;
  return s;
}

/** Fix rows where acknowledgement was saved but status was not marked completed. */
export async function reconcilePassedProgressStatus(sql: Sql): Promise<number> {
  const rows = await sql`
    UPDATE assessment_progress
    SET status = 'completed',
        completed_at = COALESCE(completed_at, last_accessed_at, updated_at, NOW()),
        last_accessed_at = COALESCE(last_accessed_at, updated_at, NOW()),
        updated_at = NOW()
    WHERE score_percent IS NOT NULL
      AND score_percent >= ${PASS_THRESHOLD_PERCENT}
      AND status IN ('not_started', 'in_progress')
      AND acknowledgement IS NOT NULL
      AND (acknowledgement->>'accepted')::boolean IS TRUE
    RETURNING id
  `;

  await sql`
    UPDATE assessment_progress
    SET completed_at = COALESCE(completed_at, last_accessed_at, updated_at, NOW()),
        last_accessed_at = COALESCE(last_accessed_at, updated_at, NOW())
    WHERE score_percent IS NOT NULL
      AND status = 'completed'
      AND (completed_at IS NULL OR last_accessed_at IS NULL)
  `;

  return rows.length;
}

function parseMcqAnswers(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, boolean>;
}

export async function getModuleMcqCount(sql: Sql, moduleId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS c FROM mcq_questions WHERE module_id = ${moduleId}
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function getProgressRow(
  sql: Sql,
  userEmail: string,
  moduleId: string,
): Promise<ProgressRow | null> {
  const rows = await sql`
    SELECT user_email, module_id, module_title, batch_id, current_slide, total_slides,
           status, warning_count, retake_count, mcq_correct, mcq_total, score_percent,
           mcq_answers, failed_reason, completed_at
    FROM assessment_progress
    WHERE user_email = ${userEmail} AND module_id = ${moduleId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    user_email: r.user_email as string,
    module_id: r.module_id as string,
    module_title: r.module_title as string,
    batch_id: r.batch_id as string,
    current_slide: Number(r.current_slide),
    total_slides: Number(r.total_slides),
    status: r.status as string,
    warning_count: Number(r.warning_count),
    retake_count: Number(r.retake_count),
    mcq_correct: Number(r.mcq_correct ?? 0),
    mcq_total: Number(r.mcq_total ?? 0),
    score_percent: r.score_percent != null ? Number(r.score_percent) : null,
    mcq_answers: parseMcqAnswers(r.mcq_answers),
    failed_reason: (r.failed_reason as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
  };
}

function scoreFromAnswers(
  answers: Record<string, boolean>,
  assignedTotal: number,
): { mcqCorrect: number; mcqTotal: number; scorePercent: number } {
  const answeredCount = Object.keys(answers).length;
  let mcqCorrect = Object.values(answers).filter(Boolean).length;

  // Denominator: the number of questions the learner actually saw.
  // 1) Prefer the assigned pool when it is at least as large as what they answered.
  // 2) Otherwise (legacy/stale rows), fall back to the answered count.
  let mcqTotal =
    assignedTotal > 0
      ? Math.max(assignedTotal, answeredCount)
      : answeredCount;

  // Cap denominator at the answered count when nothing more is expected (the
  // legacy bug stored small totals that made percent > 100%).
  if (answeredCount > 0 && mcqTotal > answeredCount) {
    mcqTotal = answeredCount;
  }

  // Safety: a corrupt row can have correct > total — clamp it.
  if (mcqCorrect > mcqTotal) mcqCorrect = mcqTotal;

  const rawPercent =
    mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 100;
  const scorePercent = Math.min(100, Math.max(0, rawPercent));
  return { mcqCorrect, mcqTotal, scorePercent };
}

export async function ensureProgressRow(
  sql: Sql,
  params: {
    userEmail: string;
    moduleId: string;
    moduleTitle: string;
    batchId: string;
    totalSlides: number;
    assignedMcqCount?: number;
  },
): Promise<ProgressRow> {
  const existing = await getProgressRow(sql, params.userEmail, params.moduleId);
  if (existing) {
    if (existing.status === "failed" && existing.score_percent != null) {
      await sql`
        UPDATE assessment_progress
        SET status = 'in_progress', updated_at = NOW()
        WHERE user_email = ${params.userEmail} AND module_id = ${params.moduleId}
      `;
      const migrated = await getProgressRow(sql, params.userEmail, params.moduleId);
      if (migrated) return migrated;
    }
    if (
      params.assignedMcqCount &&
      params.assignedMcqCount > 0 &&
      !["completed", "failed", "permanently_failed"].includes(existing.status) &&
      Object.keys(existing.mcq_answers).length === 0 &&
      existing.mcq_total !== params.assignedMcqCount
    ) {
      await sql`
        UPDATE assessment_progress
        SET mcq_total = ${params.assignedMcqCount}, updated_at = NOW()
        WHERE user_email = ${params.userEmail} AND module_id = ${params.moduleId}
      `;
      const updated = await getProgressRow(sql, params.userEmail, params.moduleId);
      if (updated) return updated;
    }
    return existing;
  }

  const mcqTotal =
    params.assignedMcqCount && params.assignedMcqCount > 0
      ? params.assignedMcqCount
      : await getModuleMcqCount(sql, params.moduleId);

  await sql`
    INSERT INTO assessment_progress (
      user_email, module_id, module_title, batch_id, current_slide, total_slides,
      status, mcq_total, mcq_correct, mcq_answers
    )
    VALUES (
      ${params.userEmail},
      ${params.moduleId},
      ${params.moduleTitle},
      ${params.batchId},
      0,
      ${params.totalSlides},
      'in_progress',
      ${mcqTotal},
      0,
      ${JSON.stringify({})}::jsonb
    )
    ON CONFLICT (user_email, module_id) DO NOTHING
  `;

  const row = await getProgressRow(sql, params.userEmail, params.moduleId);
  if (!row) {
    throw new Error("Could not create progress record.");
  }
  return row;
}

export async function saveSlideProgressDb(
  sql: Sql,
  userEmail: string,
  moduleId: string,
  currentSlide: number,
): Promise<void> {
  await sql`
    UPDATE assessment_progress
    SET current_slide = ${currentSlide}, last_accessed_at = NOW(), updated_at = NOW()
    WHERE user_email = ${userEmail} AND module_id = ${moduleId}
      AND status IN ('not_started', 'in_progress')
  `;
}

export async function recordMcqAnswerDb(
  sql: Sql,
  params: {
    userEmail: string;
    moduleId: string;
    moduleTitle: string;
    batchId: string;
    totalSlides: number;
    questionId: string;
    wasCorrect: boolean;
  },
): Promise<{ mcqCorrect: number; mcqTotal: number; alreadyAnswered?: boolean }> {
  await ensureProgressRow(sql, {
    userEmail: params.userEmail,
    moduleId: params.moduleId,
    moduleTitle: params.moduleTitle,
    batchId: params.batchId,
    totalSlides: params.totalSlides,
  });

  const row = await getProgressRow(sql, params.userEmail, params.moduleId);
  if (!row) throw new Error("Progress not found.");

  if (row.status === "completed" || row.status === "permanently_failed") {
    return { mcqCorrect: row.mcq_correct, mcqTotal: row.mcq_total };
  }
  if (row.status === "failed" && row.score_percent == null) {
    return { mcqCorrect: row.mcq_correct, mcqTotal: row.mcq_total };
  }

  if (Object.prototype.hasOwnProperty.call(row.mcq_answers, params.questionId)) {
    return {
      mcqCorrect: row.mcq_correct,
      mcqTotal: row.mcq_total,
      alreadyAnswered: true,
    };
  }

  const answers = { ...row.mcq_answers, [params.questionId]: params.wasCorrect };
  const assignedTotal =
    row.mcq_total > 0 ? row.mcq_total : await getModuleMcqCount(sql, params.moduleId);
  const { mcqCorrect, mcqTotal } = scoreFromAnswers(answers, assignedTotal);

  await sql`
    UPDATE assessment_progress
    SET mcq_answers = ${JSON.stringify(answers)}::jsonb,
        mcq_correct = ${mcqCorrect},
        mcq_total = ${mcqTotal},
        status = CASE
          WHEN status IN ('not_started', 'failed') THEN 'in_progress'
          ELSE status
        END,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE user_email = ${params.userEmail} AND module_id = ${params.moduleId}
  `;

  return { mcqCorrect, mcqTotal };
}

export async function finalizeAssessmentDb(
  sql: Sql,
  userEmail: string,
  moduleId: string,
): Promise<{
  scorePercent: number;
  passed: boolean;
  canRetake: boolean;
  mcqCorrect: number;
  mcqTotal: number;
}> {
  const row = await getProgressRow(sql, userEmail, moduleId);
  if (!row) {
    return { scorePercent: 0, passed: false, canRetake: true, mcqCorrect: 0, mcqTotal: 0 };
  }

  const { mcqCorrect, mcqTotal, scorePercent } = scoreFromAnswers(
    row.mcq_answers,
    row.mcq_total,
  );
  const passed = isPassingScore(scorePercent);
  const retakeCount = Number(row.retake_count ?? 0);
  const canRetake = !passed && retakeCount < 2;

  // Pass/fail score is saved here; status stays in_progress until acknowledgement (and feedback if required).
  const status = "in_progress";
  const failedReason = passed
    ? null
    : `Score ${scorePercent}% is below the passing threshold (${PASS_THRESHOLD_PERCENT}%).`;

  if (passed) {
    await sql`
      UPDATE assessment_progress
      SET status = ${status},
          score_percent = ${scorePercent},
          mcq_correct = ${mcqCorrect},
          mcq_total = ${mcqTotal},
          failed_reason = NULL,
          completed_at = NULL,
          last_accessed_at = NOW(),
          updated_at = NOW()
      WHERE user_email = ${userEmail} AND module_id = ${moduleId}
    `;
  } else {
    await sql`
      UPDATE assessment_progress
      SET status = ${status},
          score_percent = ${scorePercent},
          mcq_correct = ${mcqCorrect},
          mcq_total = ${mcqTotal},
          failed_reason = ${failedReason},
          last_failure_at = NOW(),
          last_failure_reason = ${failedReason},
          completed_at = NULL,
          last_accessed_at = NOW(),
          updated_at = NOW()
      WHERE user_email = ${userEmail} AND module_id = ${moduleId}
    `;
  }

  return { scorePercent, passed, canRetake, mcqCorrect, mcqTotal };
}

/** Persist training acknowledgement attestation for admin monitoring. */
export async function saveAcknowledgementDb(
  sql: Sql,
  params: {
    userEmail: string;
    moduleId: string;
    moduleTitle: string;
    feedbackRequired: boolean;
    signatureName: string;
    digitalSignature: string;
  },
): Promise<void> {
  const ack = {
    userId: params.userEmail,
    userName: params.signatureName,
    signerEmail: params.userEmail,
    assessmentId: params.moduleId,
    assessmentName: params.moduleTitle,
    accepted: true,
    timestamp: Date.now(),
    digitalSignature: params.digitalSignature,
  };

  const ackJson = JSON.stringify(ack);

  if (!params.feedbackRequired) {
    await sql`
      UPDATE assessment_progress
      SET acknowledgement = ${ackJson}::jsonb,
          status = 'completed',
          completed_at = COALESCE(completed_at, NOW()),
          last_accessed_at = NOW(),
          updated_at = NOW()
      WHERE user_email = ${params.userEmail} AND module_id = ${params.moduleId}
    `;
  } else {
    await sql`
      UPDATE assessment_progress
      SET acknowledgement = ${ackJson}::jsonb,
          last_accessed_at = NOW(),
          updated_at = NOW()
      WHERE user_email = ${params.userEmail} AND module_id = ${params.moduleId}
    `;
  }
}

/** Mark assessment completed after required feedback is submitted. */
export async function markAssessmentCompletedDb(
  sql: Sql,
  userEmail: string,
  moduleId: string,
): Promise<void> {
  await sql`
    UPDATE assessment_progress
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE user_email = ${userEmail}
      AND module_id = ${moduleId}
      AND acknowledgement IS NOT NULL
  `;
}

/** Clear slide + quiz answers so learner must start fresh (no resume). */
export async function resetInProgressAttemptDb(
  sql: Sql,
  userEmail: string,
  moduleId: string,
): Promise<void> {
  await sql`
    UPDATE assessment_progress
    SET status = 'in_progress',
        current_slide = 0,
        mcq_answers = ${JSON.stringify({})}::jsonb,
        mcq_correct = 0,
        score_percent = NULL,
        failed_reason = NULL,
        completed_at = NULL,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE user_email = ${userEmail}
      AND module_id = ${moduleId}
      AND status NOT IN ('completed', 'permanently_failed')
  `;
}

export async function startScoreRetakeDb(
  sql: Sql,
  userEmail: string,
  moduleId: string,
): Promise<{ ok: boolean; message?: string }> {
  const row = await getProgressRow(sql, userEmail, moduleId);
  if (!row) {
    return { ok: false, message: "No progress found for this assessment." };
  }

  const canRetake =
    row.score_percent != null && row.score_percent < PASS_THRESHOLD_PERCENT;

  if (!canRetake && row.status === "completed") {
    return { ok: false, message: "You passed this assessment and cannot retake it." };
  }

  if (row.status === "permanently_failed") {
    return { ok: false, message: "Maximum retakes reached." };
  }

  if (Number(row.retake_count ?? 0) >= 2) {
    return {
      ok: false,
      message: "Maximum score retakes reached. Please contact your administrator.",
    };
  }

  await sql`
    UPDATE assessment_progress
    SET status = 'in_progress',
        current_slide = 0,
        mcq_answers = ${JSON.stringify({})}::jsonb,
        mcq_correct = 0,
        mcq_total = 0,
        score_percent = NULL,
        failed_reason = NULL,
        completed_at = NULL,
        acknowledgement = NULL,
        retake_count = retake_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE user_email = ${userEmail} AND module_id = ${moduleId}
  `;

  return { ok: true };
}

export async function listProgressForUser(sql: Sql, userEmail: string) {
  const rows = await sql`
    SELECT user_email, module_id, module_title, batch_id, current_slide, total_slides,
           status, warning_count, retake_count, mcq_correct, mcq_total, score_percent,
           mcq_answers, failed_reason, completed_at
    FROM assessment_progress
    WHERE user_email = ${userEmail}
    ORDER BY last_accessed_at DESC
  `;
  return rows.map((r) => ({
    userEmail: r.user_email as string,
    moduleId: r.module_id as string,
    moduleTitle: r.module_title as string,
    batchId: r.batch_id as string,
    currentSlide: Number(r.current_slide),
    totalSlides: Number(r.total_slides),
    status: normalizeProgressStatus(
      r.status as string,
      r.score_percent != null ? Number(r.score_percent) : null,
      (r.completed_at as string) ?? null,
    ),
    warningCount: Number(r.warning_count),
    retakeCount: Number(r.retake_count),
    mcqCorrect: Number(r.mcq_correct ?? 0),
    mcqTotal: Number(r.mcq_total ?? 0),
    scorePercent: r.score_percent != null ? Number(r.score_percent) : null,
    failedReason: (r.failed_reason as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
  }));
}

export async function listProgressForBatch(sql: Sql, batchId: string) {
  const rows = await sql`
    SELECT user_email, module_id, module_title, batch_id, current_slide, total_slides,
           status, warning_count, retake_count, mcq_correct, mcq_total, score_percent,
           failed_reason, completed_at
    FROM assessment_progress
    WHERE batch_id = ${batchId}
    ORDER BY module_title, user_email
  `;
  return rows.map((r) => ({
    userEmail: r.user_email as string,
    moduleId: r.module_id as string,
    moduleTitle: r.module_title as string,
    batchId: r.batch_id as string,
    status: r.status as string,
    retakeCount: Number(r.retake_count),
    mcqCorrect: Number(r.mcq_correct ?? 0),
    mcqTotal: Number(r.mcq_total ?? 0),
    scorePercent: r.score_percent != null ? Number(r.score_percent) : null,
    failedReason: (r.failed_reason as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
  }));
}

export async function listAllProgressAdmin(sql: Sql) {
  const rows = await sql`
    SELECT user_email, module_id, module_title, batch_id, status, retake_count,
           mcq_correct, mcq_total, score_percent, failed_reason, completed_at
    FROM assessment_progress
    WHERE score_percent IS NOT NULL OR status IN ('completed', 'failed')
    ORDER BY completed_at DESC NULLS LAST, module_title
  `;
  return rows.map((r) => ({
    userEmail: r.user_email as string,
    moduleId: r.module_id as string,
    moduleTitle: r.module_title as string,
    batchId: r.batch_id as string,
    status: r.status as string,
    retakeCount: Number(r.retake_count),
    mcqCorrect: Number(r.mcq_correct ?? 0),
    mcqTotal: Number(r.mcq_total ?? 0),
    scorePercent: r.score_percent != null ? Number(r.score_percent) : null,
    failedReason: (r.failed_reason as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
  }));
}
