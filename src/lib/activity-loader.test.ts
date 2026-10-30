import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distributePromptEngineeringActivities } from "./activity-loader";
import type { CourseStepRow } from "./course-step-types";

describe("Prompt Engineering activity distribution", () => {
  it("interleaves four independent challenges throughout the course", () => {
    const base: CourseStepRow[] = [
      { stepType: "pdf", stepOrder: 1, title: "Lesson", config: {} },
      { stepType: "scenarios", stepOrder: 2, title: "Scenarios", config: {} },
      { stepType: "video", stepOrder: 3, title: "Video", config: {} },
      { stepType: "mindmap", stepOrder: 4, title: "Mind map", config: {} },
      { stepType: "infographic", stepOrder: 5, title: "Infographic", config: {} },
    ];

    const result = distributePromptEngineeringActivities(
      "course-prompt-engineering",
      "Prompt Engineering Essentials",
      base,
    );

    assert.deepEqual(
      result.map((step) => step.stepType),
      [
        "pdf",
        "activity",
        "scenarios",
        "activity",
        "video",
        "activity",
        "mindmap",
        "infographic",
        "activity",
      ],
    );
    assert.deepEqual(
      result.filter((step) => step.stepType === "activity").map((step) => step.config.activityId),
      ["block-builder", "robot-rescue", "ingredient-lab", "sprint-challenge"],
    );
    assert.match(result[1].config.assetUrl ?? "", /challenge=1/);
    assert.match(result.at(-1)?.config.assetUrl ?? "", /challenge=4/);
  });
});
