import { getSql } from "@/lib/db";
import { sendModuleInvitationEmails } from "@/lib/services/training-notification-service";
import {
  findAssignmentBatchConflicts,
  formatAssignmentConflictMessage,
} from "@/lib/services/assignment-duplicate-service";
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

    const resolvedBatchIds: string[] = batchIds.includes("all")
      ? (await sql`SELECT id FROM batches`).map((row) => row.id as string)
      : (batchIds as string[]);

    if (resolvedBatchIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Select at least one batch." },
        { status: 400 },
      );
    }

    // Reuse flow: update batch assignments for the existing module directly (no copying)
    if (reuseModuleId) {
      const sourceRows = await sql`
        SELECT id, title, pdf_url FROM training_modules WHERE id = ${String(reuseModuleId)} LIMIT 1
      `;
      if (sourceRows.length === 0) {
        return NextResponse.json(
          { ok: false, message: "Source module for reuse was not found." },
          { status: 400 },
        );
      }

      const source = sourceRows[0];
      const assignmentTitle = String(title ?? source.title).trim();
      if (!assignmentTitle) {
        return NextResponse.json(
          { ok: false, message: "Assignment name is required." },
          { status: 400 },
        );
      }

      const titleChanged =
        assignmentTitle.trim().toLowerCase() !==
        String(source.title).trim().toLowerCase();

      const conflicts = await findAssignmentBatchConflicts(sql, {
        title: assignmentTitle,
        batchIds: resolvedBatchIds,
        excludeModuleId: titleChanged ? String(reuseModuleId) : null,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            message: formatAssignmentConflictMessage(conflicts, assignmentTitle),
            conflicts,
          },
          { status: 409 },
        );
      }

      if (titleChanged) {
        await sql`
          UPDATE training_modules
          SET title = ${assignmentTitle}, updated_at = NOW()
          WHERE id = ${String(reuseModuleId)}
        `;
        await sql`
          UPDATE assessment_progress
          SET module_title = ${assignmentTitle}, updated_at = NOW()
          WHERE module_id = ${String(reuseModuleId)}
        `;
      }

      // Replace batch links with the admin's current selection
      await sql`
        DELETE FROM module_batches WHERE module_id = ${String(reuseModuleId)}
      `;

      for (const batchId of resolvedBatchIds) {
        await sql`
          INSERT INTO module_batches (module_id, batch_id)
          VALUES (${String(reuseModuleId)}, ${batchId})
          ON CONFLICT DO NOTHING
        `;
      }

      // Re-push: always resend invites to learners in the selected batches
      const inviteResult = await sendModuleInvitationEmails(
        sql,
        String(reuseModuleId),
        { forceResend: true },
      ).catch((err) => {
        console.error("[assessments reuse update invite emails]", err);
        return {
          ok: false,
          sent: 0,
          skipped: 0,
          failed: 0,
          errors: [err instanceof Error ? err.message : "Invite send failed"],
          message: "Batch assignments saved, but invitation emails could not be sent.",
        };
      });

      return NextResponse.json({
        ok: true,
        id: reuseModuleId,
        pdfUrl: sourceRows[0].pdf_url,
        queued: false,
        reused: true,
        generationStatus: "completed",
        invites: inviteResult,
      });
    }

    let contentHash: string;
    const resolvedPdfUrl = pdfUrl as string;
    const resolvedSlideCount = slideCount ?? 1;
    const assignmentTitle = String(title).trim();

    const conflicts = await findAssignmentBatchConflicts(sql, {
      title: assignmentTitle,
      batchIds: resolvedBatchIds,
    });
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          message: formatAssignmentConflictMessage(conflicts, assignmentTitle),
          conflicts,
        },
        { status: 409 },
      );
    }

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
        ${assignmentTitle},
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
      for (const batchId of resolvedBatchIds) {
        await sql`
          INSERT INTO module_batches (module_id, batch_id)
          VALUES (${id}, ${batchId})
          ON CONFLICT DO NOTHING
        `;
      }
    } else {
      for (const batchId of resolvedBatchIds) {
        await sql`
          INSERT INTO module_batches (module_id, batch_id)
          VALUES (${id}, ${batchId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    await sql`
      INSERT INTO upload_files (original_name, pdf_url, page_count, uploaded_by, module_id, content_hash)
      VALUES (${assignmentTitle}, ${resolvedPdfUrl}, ${resolvedSlideCount}, ${uploadedBy ?? null}, ${id}, ${contentHash})
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
      moduleTitle: assignmentTitle,
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
