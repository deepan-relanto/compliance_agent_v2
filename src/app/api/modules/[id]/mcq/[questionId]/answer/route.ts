import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — server-side MCQ answer validation (correct answer never sent to client beforehand) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { id: moduleId, questionId } = await params;
    const { optionId } = await req.json();

    if (!optionId || typeof optionId !== "string") {
      return NextResponse.json(
        { ok: false, error: "optionId is required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT correct_option_id FROM mcq_questions
      WHERE id = ${questionId} AND module_id = ${moduleId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Question not found." },
        { status: 404 },
      );
    }

    const correctOptionId = rows[0].correct_option_id as string;
    const correct = optionId === correctOptionId;

    return NextResponse.json({
      ok: true,
      correct,
      correctOptionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
