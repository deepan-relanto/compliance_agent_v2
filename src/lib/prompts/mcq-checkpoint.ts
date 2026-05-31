/**
 * Prompt templates for scenario-based checkpoint MCQs (direct context method).
 */

export const MCQ_SYSTEM_PROMPT = `You are a compliance training assessment designer for Relanto.
You create ONE scenario-based multiple-choice question per request.

Rules:
- Use ONLY facts from the provided slide excerpt. Do not invent policies, numbers, or names not in the text.
- Write a realistic workplace scenario (2-4 sentences) that tests understanding of that excerpt.
- Provide exactly 4 options (ids: a, b, c, d). Exactly one is clearly correct.
- Distractors must be plausible but wrong according to the excerpt.
- Professional tone. No trick questions, no "all of the above", no negative phrasing like "which is NOT".
- If the excerpt is empty or too thin to write a fair question, set "error" to "insufficient_content" and omit other fields.

Respond with valid JSON only, no markdown fences.`;

export function buildMcqUserPrompt(params: {
  moduleTitle: string;
  slideFrom: number;
  slideTo: number;
  gateSlide: number;
  excerpt: string;
}): string {
  const { moduleTitle, slideFrom, slideTo, gateSlide, excerpt } = params;
  return `Training module: "${moduleTitle}"
Checkpoint after slide ${gateSlide} (learner has viewed slides ${slideFrom} through ${slideTo}).

Slide content excerpt:
---
${excerpt.slice(0, 12000) || "(no extractable text on these slides)"}
---

Return JSON:
{
  "prompt": "scenario question text",
  "options": [
    { "id": "a", "label": "..." },
    { "id": "b", "label": "..." },
    { "id": "c", "label": "..." },
    { "id": "d", "label": "..." }
  ],
  "correctOptionId": "a|b|c|d",
  "error": null
}`;
}
