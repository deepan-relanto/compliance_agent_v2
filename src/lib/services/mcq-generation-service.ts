import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { MCQ_SYSTEM_PROMPT, buildMcqUserPrompt } from "@/lib/prompts/mcq-checkpoint";
import { extractPdfPagesText } from "@/lib/services/pdf-text-service";
import { nvidiaChatJson } from "@/lib/services/nvidia-llm";

const TARGET_POOL_SIZE = 10;

export interface GeneratedMcq {
  id: string;
  slideIndex: number;
  prompt: string;
  correctOptionId: string;
  explanation: string;
  options: { id: string; label: string }[];
}

interface LlmMcqPayload {
  questions?: Array<{
    prompt?: string;
    options?: { id: string; label: string }[];
    correctOptionId?: string;
    explanation?: string;
  }>;
}

interface SingleLlmPayload {
  prompt?: string;
  options?: { id: string; label: string }[];
  correctOptionId?: string;
  explanation?: string;
}

export function hashPdfFile(pdfUrl: string): string {
  const relative = pdfUrl.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relative);
  const buf = fs.readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = raw.slice(start, end + 1);
      try {
        return JSON.parse(sliced) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function textExcerpt(fullText: string, index: number): string {
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 60);

  const sentence =
    sentences[index % Math.max(sentences.length, 1)] ??
    fullText.replace(/\s+/g, " ").trim();

  return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}...` : sentence;
}

function generateLocalFallbackPool(
  moduleTitle: string,
  fullText: string,
): GeneratedMcq[] {
  const cleanText = fullText.replace(/\s+/g, " ").trim();
  const context =
    cleanText.length > 0
      ? cleanText
      : "the compliance material assigned in this training";

  return Array.from({ length: TARGET_POOL_SIZE }, (_, index) => {
    const excerpt = textExcerpt(context, index);
    const questionNo = index + 1;

    return {
      id: `local-fallback-${questionNo}`,
      slideIndex: questionNo * 3,
      prompt:
        `Based on "${moduleTitle}", what is the most appropriate learner action for this guidance: "${excerpt}"`,
      correctOptionId: "a",
      explanation:
        "The safest response is to use the approved compliance process because it prevents unauthorized handling, policy exceptions, and avoidable risk.",
      options: [
        {
          id: "a",
          label:
            "Apply the stated guidance and follow the required compliance process.",
        },
        {
          id: "b",
          label:
            "Ignore the guidance unless a manager repeats it during the session.",
        },
        {
          id: "c",
          label:
            "Share the information informally without checking the required controls.",
        },
        {
          id: "d",
          label:
            "Skip the checkpoint because compliance topics are optional.",
        },
      ],
    };
  });
}

async function generateMcqPool(
  moduleTitle: string,
  fullText: string,
): Promise<GeneratedMcq[]> {
  const userPrompt = buildMcqUserPrompt({ moduleTitle, fullText });
  let payload: LlmMcqPayload = {};

  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = await nvidiaChatJson(MCQ_SYSTEM_PROMPT, userPrompt, {
        maxTokens: 3000,
        temperature: 0.2,
      });
      const parsed = parseJsonObject(raw);
      if (parsed) {
        payload = parsed as unknown as LlmMcqPayload;
        break;
      }
      console.warn(`[mcq-generation] Invalid pool JSON attempt ${attempt}:`, raw.slice(0, 200));
    }
  } catch (err) {
    console.warn(
      "[mcq-generation] NVIDIA generation unavailable; using local fallback questions.",
      err instanceof Error ? err.message : err,
    );
    return generateLocalFallbackPool(moduleTitle, fullText);
  }

  const questions = payload.questions ?? [];
  const accepted: GeneratedMcq[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = q.options ?? [];
    const ids = new Set(options.map((o) => o.id));
    const correct = q.correctOptionId;
    if (
      !q.prompt ||
      options.length !== 4 ||
      !correct ||
      !ids.has(correct) ||
      ids.size !== 4
    ) {
      continue;
    }
    accepted.push({
      id: `pool-${i + 1}`,
      slideIndex: (i + 1) * 3,
      prompt: q.prompt.trim(),
      correctOptionId: correct,
      explanation:
        q.explanation?.trim() ||
        "The correct choice follows the approved compliance process and avoids unsafe shortcuts.",
      options: options.map((o) => ({
        id: String(o.id).trim(),
        label: String(o.label).trim(),
      })),
    });
    if (accepted.length >= TARGET_POOL_SIZE) break;
  }
  return accepted;
}

async function generateSingleFallback(
  moduleTitle: string,
  fullText: string,
  index: number,
): Promise<GeneratedMcq | null> {
  const prompt = `Create exactly ONE scenario question for "${moduleTitle}" using this content.

Question number target: ${index + 1}

Content:
---
${fullText.slice(0, 38000)}
---

Return strict JSON:
{
  "prompt":"...",
  "options":[
    {"id":"a","label":"..."},
    {"id":"b","label":"..."},
    {"id":"c","label":"..."},
    {"id":"d","label":"..."}
  ],
  "correctOptionId":"a|b|c|d",
  "explanation":"One sentence explaining why the correct answer is right, without repeating the option text."
}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await nvidiaChatJson(MCQ_SYSTEM_PROMPT, prompt, {
        maxTokens: 800,
        temperature: 0.2,
      });
      const parsed = parseJsonObject(raw) as SingleLlmPayload | null;
      if (!parsed) continue;
      const options = parsed.options ?? [];
      const ids = new Set(options.map((o) => o.id));
      const correct = parsed.correctOptionId;
      if (
        !parsed.prompt ||
        options.length !== 4 ||
        !correct ||
        !ids.has(correct) ||
        ids.size !== 4
      ) {
        continue;
      }
      return {
        id: `fallback-${index + 1}`,
        slideIndex: (index + 1) * 3,
        prompt: parsed.prompt.trim(),
        correctOptionId: correct,
        explanation:
          parsed.explanation?.trim() ||
          "The correct choice follows the approved compliance process and avoids unsafe shortcuts.",
        options: options.map((o) => ({ id: String(o.id).trim(), label: String(o.label).trim() })),
      };
    } catch (err) {
      console.warn(
        "[mcq-generation] Single-question NVIDIA fallback unavailable.",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }
  return null;
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
  const { moduleId, moduleTitle, pdfUrl, contentHash } = params;

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
    SET mcq_generation_status = 'generating_5', content_hash = ${contentHash}, updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  await sql`DELETE FROM mcq_options WHERE question_id IN (
    SELECT id FROM mcq_questions WHERE module_id = ${moduleId}
  )`;
  await sql`DELETE FROM mcq_questions WHERE module_id = ${moduleId}`;

  await sql`
    UPDATE training_modules
    SET mcq_generation_status = 'generating_15', updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  const pages = await extractPdfPagesText(pdfUrl);
  const fullText = pages.join("\n\n").slice(0, 45000);
  await sql`
    UPDATE training_modules
    SET mcq_generation_status = 'generating_35', updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  const pool = await generateMcqPool(moduleTitle, fullText);
  if (pool.length < TARGET_POOL_SIZE) {
    for (let i = pool.length; i < TARGET_POOL_SIZE; i++) {
      const single = await generateSingleFallback(moduleTitle, fullText, i);
      if (single) pool.push(single);
    }
  }
  if (pool.length < TARGET_POOL_SIZE) {
    const localFallback = generateLocalFallbackPool(moduleTitle, fullText);
    for (const question of localFallback) {
      if (pool.length >= TARGET_POOL_SIZE) break;
      pool.push({
        ...question,
        id: `local-fill-${pool.length + 1}`,
        slideIndex: (pool.length + 1) * 3,
      });
    }
  }
  await sql`
    UPDATE training_modules
    SET mcq_generation_status = 'generating_60', updated_at = NOW()
    WHERE id = ${moduleId}
  `;

  let generated = 0;
  for (let i = 0; i < pool.length; i++) {
    const mcq = pool[i];
    const qId = `${moduleId}-pool-${i + 1}`;
    await sql`
      INSERT INTO mcq_questions (id, module_id, slide_index, prompt, correct_option_id, explanation)
      VALUES (${qId}, ${moduleId}, ${mcq.slideIndex}, ${mcq.prompt}, ${mcq.correctOptionId}, ${mcq.explanation})
    `;
    for (const opt of mcq.options) {
      await sql`
        INSERT INTO mcq_options (id, question_id, label)
        VALUES (${opt.id}, ${qId}, ${opt.label})
      `;
    }
    generated++;
    const writeProgress = Math.min(95, 60 + Math.round(((i + 1) / Math.max(pool.length, 1)) * 35));
    await sql`
      UPDATE training_modules
      SET mcq_generation_status = ${`generating_${writeProgress}`}, updated_at = NOW()
      WHERE id = ${moduleId}
    `;
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
