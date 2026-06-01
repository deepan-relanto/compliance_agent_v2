import { getSql } from "@/lib/db";
import { copyMcqsFromModule } from "@/lib/services/mcq-copy-service";
import {
  generateAndStoreModuleMcqs,
  hashPdfFile,
} from "@/lib/services/mcq-generation-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST — persist uploaded assessment, assign batches, generate or reuse MCQs */
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
      reuseModuleId,
    } = body;

    if (!id || !title || !pdfUrl) {
      return NextResponse.json(
        { ok: false, message: "id, title, and pdfUrl are required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    let contentHash: string;
    let resolvedPdfUrl = pdfUrl as string;
    let resolvedSlideCount = slideCount ?? 1;

    if (reuseModuleId) {
      const sourceRows = await sql`
        SELECT pdf_url, content_hash, slide_count, mcq_generation_status
        FROM training_modules WHERE id = ${reuseModuleId} LIMIT 1
      `;
      if (sourceRows.length === 0) {
        return NextResponse.json(
          { ok: false, message: "Source module not found for reuse." },
          { status: 400 },
        );
      }
      const source = sourceRows[0];
      resolvedPdfUrl = source.pdf_url as string;
      contentHash = (source.content_hash as string) ?? hashPdfFile(resolvedPdfUrl);
      resolvedSlideCount = Number(source.slide_count ?? slideCount ?? 1);
    } else {
      try {
        contentHash = hashPdfFile(pdfUrl);
      } catch {
        return NextResponse.json(
          { ok: false, message: "PDF file not found on server. Upload again." },
          { status: 400 },
        );
      }
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
        ${resolvedSlideCount},
        ${durationMinutes ?? 20},
        'pdf',
        ${resolvedPdfUrl},
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

    await sql`
      INSERT INTO upload_files (original_name, pdf_url, page_count, uploaded_by, module_id, content_hash)
      VALUES (${title}, ${resolvedPdfUrl}, ${resolvedSlideCount}, ${uploadedBy ?? null}, ${id}, ${contentHash})
    `;

    let mcqCount = 0;
    let mcqSkipped = false;
    let reused = false;

    if (reuseModuleId) {
      mcqCount = await copyMcqsFromModule(sql, reuseModuleId as string, id);
      reused = true;
      if (mcqCount === 0) {
        const mcqResult = await generateAndStoreModuleMcqs(sql, {
          moduleId: id,
          moduleTitle: title,
          pdfUrl: resolvedPdfUrl,
          pageCount: resolvedSlideCount,
          contentHash,
        });
        mcqCount = mcqResult.generated;
        mcqSkipped = mcqResult.skipped;
        reused = false;
      }
    } else {
      const existingByHash = await sql`
        SELECT tm.id, (SELECT COUNT(*)::int FROM mcq_questions q WHERE q.module_id = tm.id) AS mcq_count
        FROM training_modules tm
        WHERE tm.content_hash = ${contentHash}
          AND tm.mcq_generation_status = 'completed'
          AND tm.id != ${id}
        ORDER BY tm.created_at DESC
        LIMIT 1
      `;
      if (existingByHash.length > 0 && Number(existingByHash[0].mcq_count) > 0) {
        mcqCount = await copyMcqsFromModule(
          sql,
          existingByHash[0].id as string,
          id,
        );
        reused = true;
        mcqSkipped = true;
      } else {
        const mcqResult = await generateAndStoreModuleMcqs(sql, {
          moduleId: id,
          moduleTitle: title,
          pdfUrl: resolvedPdfUrl,
          pageCount: resolvedSlideCount,
          contentHash,
        });
        mcqCount = mcqResult.generated;
        mcqSkipped = mcqResult.skipped;
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      mcqCount,
      mcqSkipped,
      reused,
      pdfUrl: resolvedPdfUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("[assessments POST]", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
