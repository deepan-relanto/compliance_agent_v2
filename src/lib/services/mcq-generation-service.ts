import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { MCQ_SYSTEM_PROMPT, buildMcqUserPrompt } from "@/lib/prompts/mcq-checkpoint";
import { chunkPagesForGate, extractPdfPagesText } from "@/lib/services/pdf-text-service";
import { nvidiaChatJson } from "@/lib/services/nvidia-llm";

const SLIDES_BETWEEN_GATES = 3;

export interface GeneratedMcq {
  id: string;
  slideIndex: number;
  prompt: string;
  correctOptionId: string;
  options: { id: string; label: string }[];
}

interface LlmMcqPayload {
  prompt?: string;
  options?: { id: string; label: string }[];
  correctOptionId?: string;
  error?: string | null;
}

export function hashPdfFile(pdfUrl: string): string {
  const relative = pdfUrl.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);
  const buf = fs.readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

async function generateOneMcq(
  moduleTitle: string,
  gateSlide: number,
  pages: string[],
): Promise<GeneratedMcq | null> {
  const { slideFrom, slideTo, excerpt } = chunkPagesForGate(pages, gateSlide);

  const userPrompt = buildMcqUserPrompt({
    moduleTitle,
    slideFrom,
    slideTo,
    gateSlide,
    excerpt,
  });

  const raw = await nvidiaChatJson(MCQ_SYSTEM_PROMPT, userPrompt);
  let payload: LlmMcqPayload;
  try {
    payload = JSON.parse(raw) as LlmMcqPayload;
  } catch {
    console.error("[mcq-generation] Invalid JSON from LLM:", raw.slice(0, 200));
    return null;
  }

  if (payload.error === "insufficient_content") {
    return null;
  }

  const options = payload.options ?? [];
  const ids = new Set(options.map((o) => o.id));
  const correct = payload.correctOptionId;
  if (
    !payload.prompt ||
    options.length !== 4 ||
    !correct ||
    !ids.has(correct) ||
    ids.size !== 4
  ) {
    console.error("[mcq-generation] Schema validation failed for gate", gateSlide);
    return null;
  }

  return {
    id: `gate-${gateSlide}`,
    slideIndex: gateSlide,
    prompt: payload.prompt.trim(),
    correctOptionId: correct,
    options: options.map((o) => ({
      id: o.id,
      label: String(o.label).trim(),
    })),
  };
}

/**
 * Generate checkpoint MCQs once per module (idempotent via content_hash).
 * Deletes prior MCQs for this module before inserting the new set.
 */
export async function generateAndStoreModuleMcqs(
  sql: ReturnType<typeof import("@/lib/db").getSql>,
  params: {
    moduleId: string;
    moduleTitle: string;
    pdfUrl: string;
    pageCount: number;
    contentHash: string;
  },
): Promise<{ generated: number; skipped: boolean }> {
  const { moduleId, moduleTitle, pdfUrl, pageCount, contentHash } = params;

  const existing = await sql`
    SELECT content_hash, mcq_generation_status
    FROM training_modules WHERE id = ${moduleId} LIMIT 1
  `;

  const priorHash = existing[0]?.content_hash as string | null;
  const countRows = await sql`
    SELECT COUNT(*)::int AS c FROM mcq_questions WHERE module_id = ${moduleId}
  `;
  const existingCount = Number(countRows[0]?.c ?? 0);

  if (
    priorHash === contentHash &&
    existingCount > 0 &&
    existing[0]?.mcq_generation_status === "completed"
  ) {
    return { generated: existingCount, skipped: true };
  }

  await sql`
    UPDATE training_modules
    SET mcq_generation_status = 'generating', content_hash = ${contentHash}, updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  await sql`DELETE FROM mcq_options WHERE question_id IN (
    SELECT id FROM mcq_questions WHERE module_id = ${moduleId}
  )`;
  await sql`DELETE FROM mcq_questions WHERE module_id = ${moduleId}`;

  const pages = await extractPdfPagesText(pdfUrl);
  const pagesToUse = Math.max(pageCount, pages.length);
  const gateSlides: number[] = [];
  for (let slide = SLIDES_BETWEEN_GATES; slide <= pagesToUse; slide += SLIDES_BETWEEN_GATES) {
    gateSlides.push(slide);
  }

  let generated = 0;
  for (const gateSlide of gateSlides) {
    const mcq = await generateOneMcq(moduleTitle, gateSlide, pages);
    if (!mcq) continue;

    const qId = `${moduleId}-gate-${gateSlide}`;
    await sql`
      INSERT INTO mcq_questions (id, module_id, slide_index, prompt, correct_option_id)
      VALUES (${qId}, ${moduleId}, ${gateSlide}, ${mcq.prompt}, ${mcq.correctOptionId})
    `;
    for (const opt of mcq.options) {
      await sql`
        INSERT INTO mcq_options (id, question_id, label)
        VALUES (${opt.id}, ${qId}, ${opt.label})
      `;
    }
    generated++;
  }

  const status = generated > 0 ? "completed" : "failed";
  await sql`
    UPDATE training_modules
    SET mcq_generation_status = ${status}, updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  if (generated === 0) {
    throw new Error(
      "Could not generate any checkpoint questions. Ensure the PDF has extractable text.",
    );
  }

  return { generated, skipped: false };
}
