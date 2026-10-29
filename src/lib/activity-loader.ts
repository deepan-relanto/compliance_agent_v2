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
    path.resolve(cwd, "..", "activity"),
    path.resolve(cwd, "public", "activity"),
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

/**
 * Checks if an activity exists in the activity folders for the given course module.
 * If found, returns its location and web asset URL.
 * If NOT found, returns `{ found: false }` so the module can gracefully skip it.
 */
export function findActivityForModule(
  moduleId: string,
  moduleTitle: string,
): ActivityResolutionResult {
  const isPromptEng =
    moduleTitle.toLowerCase().includes("prompt engineering") ||
    moduleId.toLowerCase().includes("prompt-engineering");

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
