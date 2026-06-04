import { getSql } from "@/lib/db";
import { recordMcqAnswerDb } from "@/lib/services/progress-db-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — validate MCQ answer and record score progress */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { id: moduleId, questionId } = await params;
    const body = await req.json();
    const { optionId, userEmail, moduleTitle, batchId, totalSlides } = body;

    if (!optionId || typeof optionId !== "string") {
      return NextResponse.json(
        { ok: false, error: "optionId is required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT correct_option_id, explanation FROM mcq_questions
      WHERE id = ${questionId} AND module_id = ${moduleId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Question not found." },
        { status: 404 },
      );
    }

    const correctOptionId = String(rows[0].correct_option_id ?? "").trim().toLowerCase();
    const explanation =
      typeof rows[0].explanation === "string" && rows[0].explanation.trim()
        ? rows[0].explanation.trim()
        : "This checks whether the learner applies the approved compliance process instead of taking an unsafe shortcut.";
    const correct = optionId.trim().toLowerCase() === correctOptionId;

    if (userEmail && moduleTitle && batchId) {
      const stats = await recordMcqAnswerDb(sql, {
        userEmail,
        moduleId,
        moduleTitle,
        batchId,
        totalSlides: totalSlides ?? 1,
        questionId,
        wasCorrect: correct,
      });
      return NextResponse.json({
        ok: true,
        correct,
        correctOptionId,
        explanation,
        mcqCorrect: stats.mcqCorrect,
        mcqTotal: stats.mcqTotal,
      });
    }

    return NextResponse.json({
      ok: true,
      correct,
      correctOptionId,
      explanation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
