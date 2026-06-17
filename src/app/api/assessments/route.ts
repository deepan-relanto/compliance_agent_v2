import { getSql } from "@/lib/db";
import { sendModuleInvitationEmails } from "@/lib/services/training-notification-service";
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
      questionMode = "ai",
      reuseModuleId,
    } = body;

    if (!id || !title || !pdfUrl) {
      return NextResponse.json(
        { ok: false, message: "id, title, and pdfUrl are required." },
        { status: 400 },
      );
    }

    const sql = getSql();

    // Reuse flow: update batch assignments for the existing module directly (no copying)
    if (reuseModuleId) {
      const sourceRows = await sql`
        SELECT id, pdf_url FROM training_modules WHERE id = ${String(reuseModuleId)} LIMIT 1
      `;
      if (sourceRows.length === 0) {
        return NextResponse.json(
          { ok: false, message: "Source module for reuse was not found." },
          { status: 400 },
        );
      }

      // Delete existing batch links for this module
      await sql`
        DELETE FROM module_batches WHERE module_id = ${String(reuseModuleId)}
      `;

      // Insert new batch links
      if (batchIds.includes("all")) {
        const rows = await sql`SELECT id FROM batches`;
        for (const row of rows) {
          await sql`
            INSERT INTO module_batches (module_id, batch_id)
            VALUES (${String(reuseModuleId)}, ${row.id})
            ON CONFLICT DO NOTHING
          `;
        }
      } else {
        for (const batchId of batchIds as string[]) {
          await sql`
            INSERT INTO module_batches (module_id, batch_id)
            VALUES (${String(reuseModuleId)}, ${batchId})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Send invitations to newly added users in these batches (skips already notified)
      void sendModuleInvitationEmails(sql, String(reuseModuleId)).catch((err) => {
        console.error("[assessments reuse update invite emails]", err);
      });

      return NextResponse.json({
        ok: true,
        id: reuseModuleId,
        pdfUrl: sourceRows[0].pdf_url,
        queued: false,
        reused: true,
        generationStatus: "completed",
      });
    }

    let contentHash: string;
    const resolvedPdfUrl = pdfUrl as string;
    const resolvedSlideCount = slideCount ?? 1;

    try {
      contentHash = await hashPdfFile(pdfUrl);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: "PDF file not found on server. Upload again.",
        },
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

    const mode = String(questionMode ?? "ai").toLowerCase();
    if (mode !== "ai") {
      return NextResponse.json(
        { ok: false, message: "Only AI mode is supported." },
        { status: 400 },
      );
    }

    await sql`
      UPDATE training_modules
      SET mcq_generation_status = 'pending', updated_at = NOW()
      WHERE id = ${id}
    `;

    void generateAndStoreModuleMcqs(sql, {
      moduleId: id,
      moduleTitle: title,
      pdfUrl: resolvedPdfUrl,
      pageCount: resolvedSlideCount,
      contentHash,
    }).catch(async (err) => {
      console.error("[assessments POST background generation]", err);
      await sql`
        UPDATE training_modules
        SET mcq_generation_status = 'failed', updated_at = NOW()
        WHERE id = ${id}
      `;
    });

    return NextResponse.json({
      ok: true,
      id,
      pdfUrl: resolvedPdfUrl,
      queued: true,
      generationStatus: "pending",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("[assessments POST]", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
