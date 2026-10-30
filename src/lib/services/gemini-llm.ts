const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const LEGACY_GEMINI_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
]);

export type GeminiErrorKind =
  | "not_configured"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "invalid_response";

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly kind: GeminiErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function getGeminiConfig(): { apiKey: string; model: string } {
  const apiKey = (
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  )?.trim();
  if (!apiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not configured.",
      "not_configured",
    );
  }
  const requestedModel = process.env.GEMINI_MODEL?.trim();
  return {
    apiKey,
    model:
      requestedModel && !LEGACY_GEMINI_MODELS.has(requestedModel)
        ? requestedModel
        : DEFAULT_GEMINI_MODEL,
  };
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function geminiJson(
  system: string,
  user: string,
  options?: { timeoutMs?: number; maxOutputTokens?: number },
): Promise<unknown> {
  const { apiKey, model } = getGeminiConfig();
  const timeoutMs = options?.timeoutMs ?? 9_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response | undefined;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: options?.maxOutputTokens ?? 700,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
          cache: "no-store",
        },
      );

      const transient = [500, 502, 503, 504].includes(response.status);
      if (response.ok || !transient || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiError(`Gemini timed out after ${timeoutMs}ms.`, "timeout");
    }
    throw new GeminiError(
      error instanceof Error ? error.message : "Gemini request failed.",
      "provider_error",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response) {
    throw new GeminiError("Gemini did not return a response.", "provider_error");
  }

  const raw = await response.text();
  if (!response.ok) {
    const kind: GeminiErrorKind = response.status === 429 ? "rate_limited" : "provider_error";
    throw new GeminiError(
      `Gemini API ${response.status}: ${raw.slice(0, 300)}`,
      kind,
      response.status,
    );
  }

  let envelope: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  try {
    envelope = JSON.parse(raw) as typeof envelope;
  } catch {
    throw new GeminiError("Gemini returned an invalid response envelope.", "invalid_response");
  }

  const text = envelope.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new GeminiError("Gemini returned an empty evaluation.", "invalid_response");

  try {
    return JSON.parse(stripJsonFence(text)) as unknown;
  } catch {
    throw new GeminiError("Gemini returned malformed evaluation JSON.", "invalid_response");
  }
}
