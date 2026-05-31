import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    const questions = await sql`
      SELECT id, slide_index, prompt
      FROM mcq_questions WHERE module_id = ${id}
      ORDER BY slide_index
    `;

    const mcqs = await Promise.all(
      questions.map(async (q) => {
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

    return NextResponse.json({
      ok: true,
      module: {
        id: row.id,
        title: row.title,
        description: row.description,
        slideCount: row.slide_count,
        durationMinutes: row.duration_minutes,
        status: "not_started",
        batchIds: batchRows.map((b) => b.batch_id),
        pdfUrl: row.pdf_url ?? undefined,
        contentType: row.content_type ?? "text",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
        feedbackRequired: Boolean(row.feedback_required),
      },
      mcqs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load module";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
