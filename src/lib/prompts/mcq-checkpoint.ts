/**
 * Prompt templates for generating a full question pool from the complete PDF text.
 */

export const MCQ_SYSTEM_PROMPT = `You are a compliance training assessment designer for Relanto.
Generate a pool of EXACTLY 10 scenario-based multiple-choice questions.

Rules:
- Base every question only on the provided training content.
- Use practical workplace scenarios similar to policy-violation situations.
- Each question must have exactly 4 options with ids: a, b, c, d.
- Exactly one option is correct.
- Include a one-sentence explanation that explains the reasoning, not a repeat of the option text.
- No duplicate questions.
- Avoid "all of the above" and "none of the above".
- Keep language clear and professional.

Output must be valid JSON only (no markdown) with this shape:
{
  "questions": [
    {
      "prompt": "...",
      "options": [
        {"id":"a","label":"..."},
        {"id":"b","label":"..."},
        {"id":"c","label":"..."},
        {"id":"d","label":"..."}
      ],
      "correctOptionId":"a",
      "explanation":"..."
    }
  ]
}`;

const STYLE_REFERENCE = `Style reference examples (for tone and complexity only):
1) "Ravi installs freeware on client laptop without authorization." Correct answer emphasizes prior IT/client approval.
2) "Priya copies confidential data to personal cloud for weekend work." Correct answer emphasizes approved VPN/client systems only.
3) "Ananya pastes client code into external LLM without written authorization." Correct answer prohibits this without explicit written client approval.`;

export function buildMcqUserPrompt(params: {
  moduleTitle: string;
  fullText: string;
}): string {
  const { moduleTitle, fullText } = params;
  return `Training module: "${moduleTitle}"

${STYLE_REFERENCE}

Full training content:
---
${fullText.slice(0, 45000) || "(no extractable text)"}
---

Return exactly 10 questions in the required JSON shape.`;
}
