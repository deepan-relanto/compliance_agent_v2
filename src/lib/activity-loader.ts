import fs from "node:fs";
import path from "node:path";
import type { CourseStepRow } from "@/lib/course-step-types";

/**
 * Directories scanned for activity files (in order of priority):
 * 1. Root workspace `activity/` folder (where the user keeps active lab HTMLs)
 * 2. Next.js app `public/activity/` folder
 * 3. Next.js app local `activity/` folder
 */
function getActivitySearchDirs(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "public", "activity"),
    path.resolve(cwd, "..", "activity"),
    path.resolve(cwd, "activity"),
  ];
}

export interface ActivityResolutionResult {
  found: boolean;
  filePath?: string;
  assetUrl?: string;
  title?: string;
  slug?: string;
}

export function isPromptEngineeringModule(
  moduleId: string,
  moduleTitle: string,
): boolean {
  return (
    moduleTitle.toLowerCase().includes("prompt engineering") ||
    moduleId.toLowerCase().includes("prompt-engineering")
  );
}

/**
 * Checks if an activity exists in the activity folders for the given course module.
 * If found, returns its location and web asset URL.
 * If NOT found, returns `{ found: false }` so the module can gracefully skip it.
 */
export function findActivityForModule(
  moduleId: string,
  moduleTitle: string,
): ActivityResolutionResult {
  const isPromptEng = isPromptEngineeringModule(moduleId, moduleTitle);

  const slug = isPromptEng
    ? "prompt-engineering"
    : moduleTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

  const candidateFileNames = isPromptEng
    ? [
        "prompt-engineering.html",
        "index.html",
        path.join("prompt-engineering", "index.html"),
        "prompt_engineering.html",
      ]
    : [`${slug}.html`, path.join(slug, "index.html")];

  const searchDirs = getActivitySearchDirs();

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of candidateFileNames) {
      const fullPath = path.join(dir, fileName);
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const title = isPromptEng
            ? "Prompt Engineering Activity Lab"
            : `${moduleTitle} Activity Lab`;
          return {
            found: true,
            filePath: fullPath,
            assetUrl: `/api/activity/${slug}`,
            title,
            slug,
          };
        }
      } catch {
        /* skip unreadable file */
      }
    }
  }

  return { found: false };
}

/**
 * Dynamically resolves an activity step for a module.
 * If the activity file exists on disk, returns a valid CourseStepRow.
 * If it does not exist, returns null so the caller can gracefully skip it with zero trace.
 */
export function resolveDynamicActivityStep(
  moduleId: string,
  moduleTitle: string,
): CourseStepRow | null {
  const match = findActivityForModule(moduleId, moduleTitle);
  if (!match.found || !match.assetUrl || !match.title) {
    return null;
  }

  return {
    stepType: "activity",
    stepOrder: 6,
    title: match.title,
    config: {
      assetUrl: match.assetUrl,
      originalName: match.title,
      mimeType: "text/html",
    },
  };
}

const PROMPT_ACTIVITY_SPECS = [
  { activityId: "block-builder", challenge: 1, title: "Activity 1 · Build a Complete Prompt" },
  { activityId: "robot-rescue", challenge: 2, title: "Activity 2 · Rescue a Vague Prompt" },
  { activityId: "ingredient-lab", challenge: 3, title: "Activity 3 · Select the Right Ingredients" },
  { activityId: "sprint-challenge", challenge: 4, title: "Activity 4 · Prompt Sprint" },
] as const;

/**
 * Interleave the four Prompt Engineering mastery activities across the course.
 * These are runtime-only steps, avoiding the legacy DB uniqueness constraint
 * that permits only one row per module + step_type.
 */
export function distributePromptEngineeringActivities(
  moduleId: string,
  moduleTitle: string,
  contentSteps: CourseStepRow[],
): CourseStepRow[] {
  if (!isPromptEngineeringModule(moduleId, moduleTitle) || contentSteps.length === 0) {
    return contentSteps;
  }

  const match = findActivityForModule(moduleId, moduleTitle);
  if (!match.found || !match.assetUrl) return contentSteps;

  const baseSteps = [...contentSteps]
    .filter((step) => step.stepType !== "activity")
    .sort((a, b) => a.stepOrder - b.stepOrder);
  if (!baseSteps.length) return contentSteps;

  // For five normal content sections this yields anchors 0,1,2,4:
  // after the opening lesson, early-middle, middle, and at the end.
  const lastIndex = baseSteps.length - 1;
  const anchorIndexes = [
    0,
    Math.max(0, Math.floor(lastIndex / 3)),
    Math.max(0, Math.floor((lastIndex * 2) / 3)),
    lastIndex,
  ];

  const activitiesByAnchor = new Map<number, CourseStepRow[]>();
  PROMPT_ACTIVITY_SPECS.forEach((spec, index) => {
    const anchor = anchorIndexes[index];
    const list = activitiesByAnchor.get(anchor) ?? [];
    list.push({
      stepType: "activity",
      stepOrder: 0,
      title: spec.title,
      config: {
        assetUrl: `${match.assetUrl}?challenge=${spec.challenge}`,
        originalName: spec.title,
        mimeType: "text/html",
        activityId: spec.activityId,
      },
    });
    activitiesByAnchor.set(anchor, list);
  });

  const distributed: CourseStepRow[] = [];
  baseSteps.forEach((step, index) => {
    distributed.push(step);
    distributed.push(...(activitiesByAnchor.get(index) ?? []));
  });

  // Runtime ordering only; no database rows are changed.
  return distributed.map((step, index) => ({ ...step, stepOrder: index + 1 }));
}

/**
 * Verifies whether the activity file backing a step actually exists on disk.
 * Used to gracefully skip any configured activity step whose file is missing.
 */
export function verifyActivityFileExists(
  assetUrl?: string,
  moduleTitle?: string,
): boolean {
  if (!assetUrl) return false;

  // Extract slug from /api/activity/:slug or /activity/:slug.html
  let slug = assetUrl;
  if (slug.startsWith("/api/activity/")) {
    slug = slug.replace("/api/activity/", "");
  } else if (slug.startsWith("/activity/")) {
    slug = slug.replace("/activity/", "").replace(/\.html$/, "");
  }

  if (slug.includes("?")) slug = slug.split("?")[0];
  if (slug.includes("#")) slug = slug.split("#")[0];

  const searchDirs = getActivitySearchDirs();
  const candidateNames = [
    `${slug}.html`,
    slug.endsWith(".html") ? slug : `${slug}.html`,
    path.join(slug, "index.html"),
    "index.html",
    "prompt-engineering.html",
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of candidateNames) {
      const fullPath = path.join(dir, name);
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return true;
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Also check module title fallback
  if (moduleTitle) {
    const res = findActivityForModule("", moduleTitle);
    if (res.found) return true;
  }

  return false;
}
