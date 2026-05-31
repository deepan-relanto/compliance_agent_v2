import { getSql } from "@/lib/db";
import {
  generateAndStoreModuleMcqs,
  hashPdfFile,
} from "@/lib/services/mcq-generation-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST — persist uploaded assessment and generate MCQs via NVIDIA LLM */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      description,
      slideCount,
      durationMinutes,
      pdfUrl,
      batchIds = ["all"],
      feedbackRequired = false,
      uploadedBy,
    } = body;

    if (!id || !title || !pdfUrl) {
      return NextResponse.json(
        { ok: false, message: "id, title, and pdfUrl are required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    let contentHash: string;
    try {
      contentHash = hashPdfFile(pdfUrl);
    } catch {
      return NextResponse.json(
        { ok: false, message: "PDF file not found on server. Upload again." },
        { status: 400 },
      );
    }

    await sql`
      INSERT INTO training_modules (
        id, title, description, slide_count, duration_minutes,
        content_type, pdf_url, feedback_required, content_hash, mcq_generation_status
      )
      VALUES (
        ${id},
        ${title},
        ${description ?? ""},
        ${slideCount ?? 1},
        ${durationMinutes ?? 20},
        'pdf',
        ${pdfUrl},
        ${feedbackRequired},
        ${contentHash},
        'pending'
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        slide_count = EXCLUDED.slide_count,
        duration_minutes = EXCLUDED.duration_minutes,
        pdf_url = EXCLUDED.pdf_url,
        content_hash = EXCLUDED.content_hash,
        mcq_generation_status = 'pending',
        updated_at = NOW()
    `;

    if (batchIds.includes("all")) {
      const rows = await sql`SELECT id FROM batches`;
      for (const row of rows) {
        await sql`
          INSERT INTO module_batches (module_id, batch_id)
          VALUES (${id}, ${row.id})
          ON CONFLICT DO NOTHING
        `;
      }
    } else {
      for (const batchId of batchIds as string[]) {
        await sql`
          INSERT INTO module_batches (module_id, batch_id)
          VALUES (${id}, ${batchId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    if (uploadedBy) {
      await sql`
        INSERT INTO upload_files (original_name, pdf_url, page_count, uploaded_by)
        VALUES (${title}, ${pdfUrl}, ${slideCount ?? 1}, ${uploadedBy})
      `;
    }

    const mcqResult = await generateAndStoreModuleMcqs(sql, {
      moduleId: id,
      moduleTitle: title,
      pdfUrl,
      pageCount: slideCount ?? 1,
      contentHash,
    });

    return NextResponse.json({
      ok: true,
      id,
      mcqCount: mcqResult.generated,
      mcqSkipped: mcqResult.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("[assessments POST]", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
