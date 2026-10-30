import { requireSessionEmail } from "@/lib/api-session";
import {
  ACTIVITY_EVALUATION_SYSTEM_PROMPT,
  buildActivityEvaluationPrompt,
  evaluateActivityFallback,
  normalizeGeminiEvaluation,
  parseActivityEvaluationInput,
} from "@/lib/activity-evaluation";
import { checkRateLimit, rateLimitKey } from "@/lib/request-rate-limit";
import { GeminiError, geminiJson } from "@/lib/services/gemini-llm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function fallbackResponse(
  evaluation: ReturnType<typeof evaluateActivityFallback>,
  reason: string,
) {
  return NextResponse.json(
    { ok: true, source: "fallback", fallbackReason: reason, evaluation },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Personalized activity evaluation.
 *
 * Gemini is an enhancement, never a dependency: every provider/configuration,
 * timeout, malformed-response, and rate-limit failure returns the deterministic
 * standard evaluation with HTTP 200 so the learner can always continue.
 */
export async function POST(request: NextRequest) {
  const access = await requireSessionEmail();
  if (!access.ok) return access.response;

  let input: ReturnType<typeof parseActivityEvaluationInput>;
  try {
    input = parseActivityEvaluationInput(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid activity evaluation request.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const fallback = evaluateActivityFallback(input);
  const limit = checkRateLimit(
    rateLimitKey("activity-evaluation", null, access.email),
    20,
    5 * 60_000,
  );
  if (!limit.ok) return fallbackResponse(fallback, "application_rate_limited");

  try {
    const rawEvaluation = await geminiJson(
      ACTIVITY_EVALUATION_SYSTEM_PROMPT,
      buildActivityEvaluationPrompt(input),
    );
    const evaluation = normalizeGeminiEvaluation(rawEvaluation, fallback);
    return NextResponse.json(
      { ok: true, source: "gemini", evaluation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const reason = error instanceof GeminiError ? error.kind : "provider_error";
    const status = error instanceof GeminiError && error.status
      ? `, HTTP ${error.status}`
      : "";
    console.warn(`[activity-evaluation] Gemini unavailable; using standard evaluator (${reason}${status}).`);
    return fallbackResponse(fallback, reason);
  }
}
