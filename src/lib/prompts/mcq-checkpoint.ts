/**
 * Prompt templates for generating a full question pool from the complete PDF text.
 */

export const MCQ_SYSTEM_PROMPT = `You are a senior compliance assessment designer at Relanto (IT services / enterprise training).

Your job: write realistic workplace SCENARIO questions that test whether a learner would make the correct decision under pressure.

Every question MUST:
1. Open with a named employee in a specific situation (e.g. "Meera is working from a café…", "Rahul receives a USB from a vendor…").
2. Describe a concrete action they want to take or a dilemma they face — tied to the training content.
3. End with "What should they do?" or "What is the best course of action?"
4. Offer exactly 4 options (ids: a, b, c, d) — one clearly correct per policy, three plausible but non-compliant distractors.
5. Include an "explanation" of exactly TWO sentences (40–220 characters total):
   - Sentence 1: why the correct option follows policy / protects client data.
   - Sentence 2: why the tempting wrong options create compliance, security, or approval risk.
   Do NOT copy option labels verbatim. Be specific to the scenario.

Rules:
- Base every question ONLY on the provided training content — no invented policies.
- No duplicate or near-duplicate scenarios.
- No "all of the above" / "none of the above".
- Professional tone; Indian/global enterprise context is fine.
- Output valid JSON only (no markdown).

JSON shape:
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

const STYLE_REFERENCE = `Scenario style examples (tone and structure only — do not copy verbatim):

1) "Ananya needs to finish a client report tonight. She considers copying files to her personal Google Drive so she can work from home. What should she do?"
   Correct: use only approved VPN and client systems with prior authorization.

2) "Vikram finds a free PDF converter online and wants to upload a confidential slide deck to merge pages quickly. What is the best action?"
   Correct: use only IT-approved tools; never upload client data to unapproved sites.

3) "Priya receives a Teams message with a login link that looks like Microsoft but the URL is slightly misspelled. What should she do first?"
   Correct: do not click; report via the official security channel.`;

export function buildMcqUserPrompt(params: {
  moduleTitle: string;
  fullText: string;
  questionCount: number;
}): string {
  const { moduleTitle, fullText, questionCount } = params;
  return `Training module: "${moduleTitle}"

${STYLE_REFERENCE}

Full training content (source material — every scenario must be grounded here):
---
${fullText.slice(0, 45000) || "(no extractable text)"}
---

Generate exactly ${questionCount} unique scenario-based questions in the required JSON shape.
Each prompt must read like a short story (3–5 sentences) before asking for the best action.
Each explanation must be two specific sentences — never generic filler.`;
}
