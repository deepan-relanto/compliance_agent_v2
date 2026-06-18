import { requireSessionEmail } from "@/lib/api-session";
import { getSql } from "@/lib/db";
import { clientPdfUrl } from "@/lib/pdf-url";
import { listProgressForUser } from "@/lib/services/progress-db-service";
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
    pdfUrl: clientPdfUrl(row.pdf_url as string),
    contentType: (row.content_type as "text" | "pdf") || "text",
    createdAt: row.created_at
      ? new Date(row.created_at as string).getTime()
      : undefined,
    feedbackRequired: Boolean(row.feedback_required),
  };
}

/** GET ?batchId=&userEmail= — modules + progress in one round trip */
export async function GET(req: NextRequest) {
  try {
    const batchId = req.nextUrl.searchParams.get("batchId");
    const claimedEmail = req.nextUrl.searchParams.get("userEmail")?.trim() ?? "";

    if (!batchId) {
      return NextResponse.json(
        { ok: false, error: "batchId is required." },
        { status: 400 },
      );
    }

    const access = await requireSessionEmail(claimedEmail || null);
    if (!access.ok) return access.response;

    const sql = getSql();
    const userEmail = access.email;
    const [rows, progress] = await Promise.all([
      sql`
        SELECT
          m.*,
          ARRAY_AGG(DISTINCT mb_all.batch_id) FILTER (WHERE mb_all.batch_id IS NOT NULL) AS batch_ids
        FROM training_modules m
        INNER JOIN module_batches mb_filter ON mb_filter.module_id = m.id
        LEFT JOIN module_batches mb_all ON mb_all.module_id = m.id
        WHERE mb_filter.batch_id = ${batchId}
          AND m.mcq_generation_status = 'completed'
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `,
      userEmail ? listProgressForUser(sql, userEmail) : Promise.resolve([]),
    ]);

    const modules = rows.map((row) =>
      mapModule(row, ((row.batch_ids as string[] | null) ?? []).filter(Boolean)),
    );

    return NextResponse.json({ ok: true, modules, progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
