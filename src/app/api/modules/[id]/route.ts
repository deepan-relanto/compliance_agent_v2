import { getSql } from "@/lib/db";
import { PASS_THRESHOLD_PERCENT } from "@/lib/constants";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userEmail = req.nextUrl.searchParams.get("userEmail") ?? "";
    const sql = getSql();

    const rows = await sql`
      SELECT * FROM training_modules WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Module not found" }, { status: 404 });
    }

    const row = rows[0];
    const batchRows = await sql`
      SELECT batch_id FROM module_batches WHERE module_id = ${id}
    `;

    const questionRows = await sql`
      SELECT id, slide_index, prompt
      FROM mcq_questions WHERE module_id = ${id}
      ORDER BY slide_index
    `;

    const mcqPool = await Promise.all(
      questionRows.map(async (q) => {
        const opts = await sql`
          SELECT id, label FROM mcq_options WHERE question_id = ${q.id}
        `;
        return {
          id: q.id,
          slideIndex: q.slide_index,
          prompt: q.prompt,
          options: opts.map((o) => ({ id: o.id, label: o.label })),
        };
      }),
    );

    const progressRows =
      userEmail
        ? await sql`
            SELECT status, retake_count, score_percent, completed_at, acknowledgement
            FROM assessment_progress
            WHERE user_email = ${userEmail} AND module_id = ${id}
            LIMIT 1
          `
        : [];
    const progress = progressRows[0];
    const rawStatus = (progress?.status as string | undefined) ?? "not_started";
    const scorePercent =
      progress?.score_percent != null ? Number(progress.score_percent) : null;
    const progressStatus =
      rawStatus === "failed" && scorePercent != null
        ? "in_progress"
        : rawStatus;
    const hasAck = hasAcceptedAcknowledgement(progress?.acknowledgement);
    const isCompleted = progressStatus === "completed" && hasAck;
    const passedPendingAck =
      scorePercent != null &&
      scorePercent > PASS_THRESHOLD_PERCENT &&
      !hasAck &&
      progressStatus !== "permanently_failed";
    const retakeCount = Number(progress?.retake_count ?? 0);
    const isScoreRetake =
      !isCompleted &&
      !passedPendingAck &&
      progressStatus !== "permanently_failed" &&
      ((scorePercent != null && scorePercent <= PASS_THRESHOLD_PERCENT) ||
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

    const needed =
      viewerMode === "quiz_only_retake"
        ? mcqPool.length
        : gateSlides.length > 0
          ? gateSlides.length
          : mcqPool.length;
    const randomized = userEmail
      ? seededShuffle(mcqPool, `${id}:${userEmail}`)
      : mcqPool;
    const selected = randomized.slice(0, Math.max(needed, 1));

    const mcqs = selected.map((q, index) => ({
      ...q,
      slideIndex: gateSlides[index] ?? q.slideIndex,
    }));

    return NextResponse.json({
      ok: true,
      module: {
        id: row.id,
        title: row.title,
        description: row.description,
        slideCount: row.slide_count,
        durationMinutes: row.duration_minutes,
        status: progressStatus,
        batchIds: batchRows.map((b) => b.batch_id),
        pdfUrl: row.pdf_url ?? undefined,
        contentType: row.content_type ?? "text",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
        feedbackRequired: Boolean(row.feedback_required),
        viewerMode,
      },
      mcqs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load module";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
