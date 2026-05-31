import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mapModule(row: Record<string, unknown>, batchIds: string[]) {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    slideCount: row.slide_count as number,
    durationMinutes: row.duration_minutes as number,
    status: "not_started" as const,
    batchIds,
    pdfUrl: (row.pdf_url as string) || undefined,
    contentType: (row.content_type as "text" | "pdf") || "text",
    createdAt: row.created_at
      ? new Date(row.created_at as string).getTime()
      : undefined,
    feedbackRequired: Boolean(row.feedback_required),
  };
}

export async function GET(req: NextRequest) {
  try {
    const batchId = req.nextUrl.searchParams.get("batchId");
    if (!batchId) {
      return NextResponse.json(
        { ok: false, error: "batchId query parameter is required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT DISTINCT m.*
      FROM training_modules m
      INNER JOIN module_batches mb ON mb.module_id = m.id
      WHERE mb.batch_id = ${batchId}
      ORDER BY m.created_at DESC
    `;

    const modules = await Promise.all(
      rows.map(async (row) => {
        const batchRows = await sql`
          SELECT batch_id FROM module_batches WHERE module_id = ${row.id}
        `;
        return mapModule(
          row,
          batchRows.map((b) => b.batch_id as string),
        );
      }),
    );

    return NextResponse.json({ ok: true, modules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load modules";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
