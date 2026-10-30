import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildActivityEvaluationPrompt,
  evaluateActivityFallback,
  normalizeGeminiEvaluation,
  parseActivityEvaluationInput,
} from "./activity-evaluation";

describe("activity evaluation fallback", () => {
  it("scores a complete block builder selection at full marks", () => {
    const input = parseActivityEvaluationInput({
      activityId: "block-builder",
      answer: { selected: ["role", "ctx", "task", "fmt", "tone", "con"] },
    });
    assert.equal(evaluateActivityFallback(input).score, 25);
  });

  it("uses semantic-standard keyword scoring for robot rescue", () => {
    const input = parseActivityEvaluationInput({
      activityId: "robot-rescue",
      answer: {
        text: "Act as a sales analyst. Analyze our quarterly dataset and summarize the findings in a table for executives.",
      },
    });
    const evaluation = evaluateActivityFallback(input);
    assert.equal(evaluation.score, 25);
    assert.equal(evaluation.criteria.filter((criterion) => criterion.met).length, 5);
  });

  it("penalizes ingredient distractors without throwing", () => {
    const input = parseActivityEvaluationInput({
      activityId: "ingredient-lab",
      answer: { selected: ["i1", "i2", "i3", "i7", "i8"] },
    });
    assert.equal(evaluateActivityFallback(input).score, 8);
  });

  it("sends meaningful structured labels and a standard baseline to Gemini", () => {
    const input = parseActivityEvaluationInput({
      activityId: "ingredient-lab",
      answer: { selected: ["i1", "i2", "i7"] },
    });
    const prompt = buildActivityEvaluationPrompt(input);
    assert.match(prompt, /Legal role/);
    assert.match(prompt, /Comedy mode/);
    assert.match(prompt, /distractor/);
    assert.match(prompt, /Standard evaluator baseline/);
  });

  it("normalizes Gemini output and clamps the score", () => {
    const input = parseActivityEvaluationInput({
      activityId: "sprint-challenge",
      answer: { text: "Write a concise professional LinkedIn post about my Engineering Manager promotion and thank the team." },
    });
    const fallback = evaluateActivityFallback(input);
    const normalized = normalizeGeminiEvaluation(
      {
        score: 99,
        title: "Tailored result",
        feedback: "You clearly named LinkedIn and the promotion. Add an audience and desired voice.",
        criteria: [{ id: "platform", label: "Platform", met: true }],
      },
      fallback,
    );
    assert.equal(normalized.score, 25);
    assert.equal(normalized.level, "success");
    assert.equal(normalized.title, "Tailored result");
  });

  it("rejects unsupported activities", () => {
    assert.throws(() =>
      parseActivityEvaluationInput({ activityId: "unknown", answer: { text: "test" } }),
    );
  });
});
