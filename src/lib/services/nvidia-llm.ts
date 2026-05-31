const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

/** Default: strong instruct model on NVIDIA integrate API. */
export const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

export function getNvidiaConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set in .env");
  }
  return {
    apiKey,
    model: process.env.NVIDIA_MODEL?.trim() || DEFAULT_NVIDIA_MODEL,
  };
}

export async function nvidiaChatJson(
  system: string,
  user: string,
): Promise<string> {
  const { apiKey, model } = getNvidiaConfig();

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.25,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`NVIDIA API ${res.status}: ${raw.slice(0, 400)}`);
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("NVIDIA API returned non-JSON response");
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("NVIDIA API returned empty completion");
  }
  return content;
}
