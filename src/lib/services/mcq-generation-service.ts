import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { normalizeMcqExplanation } from "@/lib/mcq-explanation";
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

const JUNK_TEXT_PATTERN =
  /copyright|©|\ball rights reserved\b|\bconfidential\b|\bpage\s+\d+\b|\brelanto inc\b|\bunauthorized reproduction\b/i;

function isUsablePassage(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 80 || cleaned.length > 420) return false;
  if (JUNK_TEXT_PATTERN.test(cleaned)) return false;
  if (/^[\d\s\-–—.]+$/.test(cleaned)) return false;
  const words = cleaned.split(/\s+/);
  if (words.length < 12) return false;
  return true;
}

function extractContentPassages(fullText: string, pages: string[]): string[] {
  const passages: string[] = [];

  const pageSlice =
    pages.length > 2 ? pages.slice(1, -1) : pages.length > 0 ? pages : [];

  for (const page of pageSlice) {
    for (const paragraph of page.split(/\n{2,}/)) {
      const cleaned = paragraph.replace(/\s+/g, " ").trim();
      if (isUsablePassage(cleaned)) passages.push(cleaned);
    }
  }

  if (passages.length === 0) {
    for (const sentence of fullText.split(/(?<=[.!?])\s+/)) {
      const cleaned = sentence.replace(/\s+/g, " ").trim();
      if (isUsablePassage(cleaned)) passages.push(cleaned);
    }
  }

  return passages;
}

const FALLBACK_SCENARIOS: Array<{
  buildPrompt: (title: string, topic?: string) => string;
  correctOptionId: "a" | "b" | "c" | "d";
  explanation: string;
  options: { id: "a" | "b" | "c" | "d"; label: string }[];
}> = [
  {
    buildPrompt: (title, topic) =>
      topic
        ? `While completing "${title}", a colleague asks you to ignore the guidance on ${topic.slice(0, 120)}. What is the best response?`
        : `While completing "${title}", a colleague asks you to skip the approved security controls to save time. What is the best response?`,
    correctOptionId: "a",
    explanation:
      "Approved controls exist to reduce risk. The correct action is to follow the documented process and escalate exceptions through the proper channel.",
    options: [
      { id: "a", label: "Follow the approved process and escalate exceptions through the proper channel." },
      { id: "b", label: "Agree to skip controls if the request comes from a senior colleague." },
      { id: "c", label: "Handle it informally and document it later if something goes wrong." },
      { id: "d", label: "Ignore the policy because training checkpoints are optional." },
    ],
  },
  {
    buildPrompt: (title) =>
      `You are working on "${title}" from a public network without the approved VPN. What should you do before accessing company systems or client data?`,
    correctOptionId: "b",
    explanation:
      "Approved VPN or secure access paths protect traffic on untrusted networks. Public Wi‑Fi without those controls can expose credentials and client data.",
    options: [
      { id: "a", label: "Proceed if the website already uses HTTPS." },
      { id: "b", label: "Connect through the approved VPN or other authorized secure access method." },
      { id: "c", label: "Use a personal hotspot and disable security tools to improve speed." },
      { id: "d", label: "Ask a teammate to log in on your behalf." },
    ],
  },
  {
    buildPrompt: (title) =>
      `During "${title}", you receive a message asking you to share credentials so a teammate can finish a task faster. What is the correct action?`,
    correctOptionId: "c",
    explanation:
      "Each person must use their own authorized account so access can be audited. Sharing credentials removes accountability and violates standard security policy.",
    options: [
      { id: "a", label: "Share credentials temporarily if the teammate is trusted." },
      { id: "b", label: "Send credentials over chat and delete the message afterward." },
      { id: "c", label: "Refuse to share credentials and request access through the approved process." },
      { id: "d", label: "Use the teammate's credentials if they offer them first." },
    ],
  },
  {
    buildPrompt: (title, topic) =>
      topic
        ? `A stakeholder asks you to email ${topic.slice(0, 100)} outside the approved client systems. What is the most compliant response?`
        : `A stakeholder asks you to move confidential training material to personal cloud storage for convenience. What is the most compliant response?`,
    correctOptionId: "a",
    explanation:
      "Approved systems include the required monitoring, retention, and access controls. Personal or unapproved channels bypass those protections.",
    options: [
      { id: "a", label: "Use only approved systems and obtain written authorization before any exception." },
      { id: "b", label: "Use personal storage if you delete the files after the task." },
      { id: "c", label: "Share externally if the recipient signs a verbal agreement." },
      { id: "d", label: "Proceed when the deadline is tight and approval can wait." },
    ],
  },
  {
    buildPrompt: (title) =>
      `You notice a suspicious link while reviewing "${title}" materials on your work device. What should you do first?`,
    correctOptionId: "d",
    explanation:
      "Reporting suspicious links lets security teams investigate before harm occurs. Opening or forwarding them can spread malware or credential theft.",
    options: [
      { id: "a", label: "Open the link in a private browser window to inspect it." },
      { id: "b", label: "Forward the link to colleagues so they can help evaluate it." },
      { id: "c", label: "Ignore it unless your antivirus flags it automatically." },
      { id: "d", label: "Do not click the link and report it through the approved security channel." },
    ],
  },
];

function generateLocalFallbackPool(
  moduleTitle: string,
  fullText: string,
  pages: string[] = [],
): GeneratedMcq[] {
  const passages = extractContentPassages(fullText, pages);

  return Array.from({ length: TARGET_POOL_SIZE }, (_, index) => {
    const scenario = FALLBACK_SCENARIOS[index % FALLBACK_SCENARIOS.length];
    const topic = passages[index % Math.max(passages.length, 1)];
    const questionNo = index + 1;

    return {
      id: `local-fallback-${questionNo}`,
      slideIndex: questionNo * 3,
      prompt: scenario.buildPrompt(moduleTitle, topic),
      correctOptionId: scenario.correctOptionId,
      explanation: scenario.explanation,
      options: scenario.options,
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
    return generateLocalFallbackPool(moduleTitle, fullText, []);
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
    const normalizedOptions = options.map((o) => ({
      id: String(o.id).trim(),
      label: String(o.label).trim(),
    }));
    const correctLabel =
      normalizedOptions.find((o) => o.id === correct)?.label ?? "";

    accepted.push({
      id: `pool-${i + 1}`,
      slideIndex: (i + 1) * 3,
      prompt: q.prompt.trim(),
      correctOptionId: correct,
      explanation: normalizeMcqExplanation(q.explanation, correctLabel),
      options: normalizedOptions,
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
  "explanation":"Exactly two short sentences: why the correct answer is right, then why the wrong options are unsafe."
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
      const normalizedOptions = options.map((o) => ({
        id: String(o.id).trim(),
        label: String(o.label).trim(),
      }));
      const correctLabel =
        normalizedOptions.find((o) => o.id === correct)?.label ?? "";

      return {
        id: `fallback-${index + 1}`,
        slideIndex: (index + 1) * 3,
        prompt: parsed.prompt.trim(),
        correctOptionId: correct,
        explanation: normalizeMcqExplanation(parsed.explanation, correctLabel),
        options: normalizedOptions,
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
    force?: boolean;
  },
): Promise<{ generated: number; skipped: boolean }> {
  const { moduleId, moduleTitle, pdfUrl, contentHash, force = false } = params;

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
    !force &&
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
    const localFallback = generateLocalFallbackPool(moduleTitle, fullText, pages);
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

  if (status === "completed") {
    const { sendModuleInvitationEmails } = await import(
      "@/lib/services/training-notification-service"
    );
    void sendModuleInvitationEmails(sql, moduleId).catch((err) => {
      console.error("[mcq-generation invite emails]", err);
    });
  }

  if (generated === 0) {
    throw new Error(
      "Could not generate any checkpoint questions. Ensure the PDF has extractable text.",
    );
  }

  return { generated, skipped: false };
}
