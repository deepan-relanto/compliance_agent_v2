import type { getSql } from "@/lib/db";
import { PASS_THRESHOLD_PERCENT } from "@/lib/constants";

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

export async function ensureProgressRow(
  sql: Sql,
  params: {
    userEmail: string;
    moduleId: string;
    moduleTitle: string;
    batchId: string;
    totalSlides: number;
  },
): Promise<ProgressRow> {
  const existing = await getProgressRow(sql, params.userEmail, params.moduleId);
  if (existing) return existing;

  const mcqTotal = await getModuleMcqCount(sql, params.moduleId);

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
): Promise<{ mcqCorrect: number; mcqTotal: number }> {
  await ensureProgressRow(sql, {
    userEmail: params.userEmail,
    moduleId: params.moduleId,
    moduleTitle: params.moduleTitle,
    batchId: params.batchId,
    totalSlides: params.totalSlides,
  });

  const row = await getProgressRow(sql, params.userEmail, params.moduleId);
  if (!row) throw new Error("Progress not found.");

  if (["completed", "failed", "permanently_failed"].includes(row.status)) {
    return { mcqCorrect: row.mcq_correct, mcqTotal: row.mcq_total };
  }

  const answers = { ...row.mcq_answers, [params.questionId]: params.wasCorrect };
  const mcqCorrect = Object.values(answers).filter(Boolean).length;
  const mcqTotal = Math.max(row.mcq_total, await getModuleMcqCount(sql, params.moduleId));

  await sql`
    UPDATE assessment_progress
    SET mcq_answers = ${JSON.stringify(answers)}::jsonb,
        mcq_correct = ${mcqCorrect},
        mcq_total = ${mcqTotal},
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

  const mcqTotal = Math.max(row.mcq_total, await getModuleMcqCount(sql, moduleId));
  const mcqCorrect = row.mcq_correct;
  const scorePercent =
    mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 100;
  const passed = scorePercent > PASS_THRESHOLD_PERCENT;
  const canRetake = !passed;

  const status = passed ? "completed" : "failed";
  const failedReason = passed
    ? null
    : `Score ${scorePercent}% is at or below the passing threshold (${PASS_THRESHOLD_PERCENT}%).`;

  if (passed) {
    await sql`
      UPDATE assessment_progress
      SET status = ${status},
          score_percent = ${scorePercent},
          mcq_correct = ${mcqCorrect},
          mcq_total = ${mcqTotal},
          failed_reason = NULL,
          completed_at = NOW(),
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
          completed_at = NULL,
          last_accessed_at = NOW(),
          updated_at = NOW()
      WHERE user_email = ${userEmail} AND module_id = ${moduleId}
    `;
  }

  return { scorePercent, passed, canRetake, mcqCorrect, mcqTotal };
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
    row.score_percent != null && row.score_percent <= PASS_THRESHOLD_PERCENT;

  if (!canRetake && row.status === "completed") {
    return { ok: false, message: "You passed this assessment and cannot retake it." };
  }

  if (row.status === "permanently_failed") {
    return { ok: false, message: "Maximum retakes reached." };
  }

  const mcqTotal = await getModuleMcqCount(sql, moduleId);

  await sql`
    UPDATE assessment_progress
    SET status = 'not_started',
        current_slide = 0,
        mcq_answers = ${JSON.stringify({})}::jsonb,
        mcq_correct = 0,
        mcq_total = ${mcqTotal},
        score_percent = NULL,
        failed_reason = NULL,
        completed_at = NULL,
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
    status: r.status as string,
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
