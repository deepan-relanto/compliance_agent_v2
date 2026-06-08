import { getSql } from "@/lib/db";
import { PASS_THRESHOLD_PERCENT, isPassingScore } from "@/lib/constants";
import { clientPdfUrl } from "@/lib/pdf-url";
import { dedupeMcqsByPrompt, gateCountForSlides } from "@/lib/mcq-dedupe";

type Sql = ReturnType<typeof getSql>;

function seededShuffle<T>(items: T[], seedText: string): T[] {
  const arr = [...items];
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hasAcceptedAcknowledgement(raw: unknown): boolean {
  if (!raw) return false;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Boolean(value && typeof value === "object" && (value as { accepted?: boolean }).accepted);
  } catch {
    return false;
  }
}

export interface ModuleMcqRow {
  id: string;
  slideIndex: number;
  prompt: string;
  options: { id: string; label: string }[];
}

/** Load module + batches + MCQs (single options query) + optional progress. */
export async function loadModuleDetail(
  sql: Sql,
  moduleId: string,
  userEmail: string,
) {
  const [moduleRows, batchRows, questionRows, progressRows] = await Promise.all([
    sql`SELECT * FROM training_modules WHERE id = ${moduleId} LIMIT 1`,
    sql`SELECT batch_id FROM module_batches WHERE module_id = ${moduleId}`,
    sql`
      SELECT id, slide_index, prompt
      FROM mcq_questions
      WHERE module_id = ${moduleId}
      ORDER BY slide_index
    `,
    userEmail
      ? sql`
          SELECT status, retake_count, score_percent, completed_at, acknowledgement
          FROM assessment_progress
          WHERE user_email = ${userEmail} AND module_id = ${moduleId}
          LIMIT 1
        `
      : Promise.resolve([]),
  ]);

  if (moduleRows.length === 0) return null;

  const row = moduleRows[0];
  const questionIds = questionRows.map((q) => q.id as string);

  const optionsByQuestion = new Map<string, { id: string; label: string }[]>();
  if (questionIds.length > 0) {
    const optRows = await sql`
      SELECT question_id, id, label
      FROM mcq_options
      WHERE question_id = ANY(${questionIds})
      ORDER BY question_id, id
    `;
    for (const o of optRows) {
      const qid = o.question_id as string;
      const list = optionsByQuestion.get(qid) ?? [];
      list.push({ id: o.id as string, label: o.label as string });
      optionsByQuestion.set(qid, list);
    }
  }

  const mcqPool: ModuleMcqRow[] = questionRows.map((q) => ({
    id: q.id as string,
    slideIndex: Number(q.slide_index),
    prompt: q.prompt as string,
    options: optionsByQuestion.get(q.id as string) ?? [],
  }));

  const progress = progressRows[0];
  const rawStatus = (progress?.status as string | undefined) ?? "not_started";
  const scorePercent =
    progress?.score_percent != null ? Number(progress.score_percent) : null;
  const progressStatus =
    rawStatus === "failed" && scorePercent != null ? "in_progress" : rawStatus;
  const hasAck = hasAcceptedAcknowledgement(progress?.acknowledgement);
  const isCompleted = progressStatus === "completed" && hasAck;
  const passedPendingAck =
    isPassingScore(scorePercent) &&
    !hasAck &&
    progressStatus !== "permanently_failed";
  const retakeCount = Number(progress?.retake_count ?? 0);
  const isScoreRetake =
    !isCompleted &&
    !passedPendingAck &&
    progressStatus !== "permanently_failed" &&
    ((scorePercent != null && scorePercent < PASS_THRESHOLD_PERCENT) ||
      (retakeCount > 0 &&
        scorePercent == null &&
        (progressStatus === "in_progress" || rawStatus === "failed")));
  const viewerMode:
    | "standard"
    | "quiz_only_retake"
    | "review_only"
    | "acknowledgement_pending" = isCompleted
    ? "review_only"
    : passedPendingAck
      ? "acknowledgement_pending"
      : isScoreRetake
        ? "quiz_only_retake"
        : "standard";

  const slideCount = Number(row.slide_count ?? 1);
  const gateSlides: number[] = [];
  for (let slide = 3; slide <= Math.max(slideCount, 3); slide += 3) {
    gateSlides.push(slide);
  }

  const uniquePool = dedupeMcqsByPrompt(mcqPool);
  const gateTotal = gateCountForSlides(slideCount);
  const needed =
    viewerMode === "quiz_only_retake"
      ? uniquePool.length
      : gateTotal > 0
        ? Math.min(gateTotal, uniquePool.length)
        : uniquePool.length;
  const randomized = userEmail
    ? seededShuffle(uniquePool, `${moduleId}:${userEmail}:v2`)
    : uniquePool;
  const selected = randomized.slice(0, Math.max(needed, 1));

  const mcqs = selected.map((q, index) => ({
    ...q,
    slideIndex: gateSlides[index] ?? q.slideIndex,
  }));

  return {
    module: {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      slideCount: row.slide_count as number,
      durationMinutes: row.duration_minutes as number,
      status: progressStatus,
      batchIds: batchRows.map((b) => b.batch_id as string),
      pdfUrl: clientPdfUrl(row.pdf_url as string),
      contentType: (row.content_type as string) ?? "text",
      createdAt: row.created_at ? new Date(row.created_at as string).getTime() : undefined,
      feedbackRequired: Boolean(row.feedback_required),
      viewerMode,
    },
    mcqs,
  };
}
