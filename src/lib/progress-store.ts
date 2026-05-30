/**
 * progress-store.ts
 *
 * Lightweight localStorage-backed progress tracking.
 * Follows the same pattern as the uploaded-assessment store in mock-data.ts.
 * Key: "compliance-progress"
 * Shape: Record<"username|moduleId", AssessmentProgress>
 */

import type { ModuleStatus } from "./types";

export interface AssessmentProgress {
  username: string;
  moduleId: string;
  moduleTitle: string;
  batchId: string;
  currentSlide: number;   // 0-based index of last viewed slide
  totalSlides: number;
  status: ModuleStatus;
  lastAccessedAt: number; // Unix ms
  completedAt?: number;   // Unix ms, only set when status === "completed"
}

const STORE_KEY = "compliance-progress";

// ── Low-level helpers ─────────────────────────────────────────────────────────

function readAll(): Record<string, AssessmentProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AssessmentProgress>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, AssessmentProgress>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function key(username: string, moduleId: string): string {
  return `${username}|${moduleId}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called when the assessment viewer mounts (user opens the assessment).
 * Creates an "in_progress" record if none exists; leaves "completed" alone.
 */
export function markInProgress(
  username: string,
  moduleId: string,
  moduleTitle: string,
  batchId: string,
  totalSlides: number,
): void {
  const all = readAll();
  const k = key(username, moduleId);
  const existing = all[k];

  // Never downgrade a completed assessment back to in_progress
  if (existing?.status === "completed") return;

  all[k] = {
    username,
    moduleId,
    moduleTitle,
    batchId,
    currentSlide: existing?.currentSlide ?? 0,
    totalSlides,
    status: "in_progress",
    lastAccessedAt: Date.now(),
    completedAt: existing?.completedAt,
  };
  writeAll(all);
}

/**
 * Called on every page navigation inside the viewer.
 */
export function saveSlideProgress(
  username: string,
  moduleId: string,
  currentSlide: number,
): void {
  const all = readAll();
  const k = key(username, moduleId);
  const existing = all[k];
  if (!existing || existing.status === "completed") return;

  all[k] = {
    ...existing,
    currentSlide,
    lastAccessedAt: Date.now(),
  };
  writeAll(all);
}

/**
 * Called when the user reaches the final QA/feedback screen.
 */
export function markCompleted(username: string, moduleId: string): void {
  const all = readAll();
  const k = key(username, moduleId);
  const existing = all[k];
  if (!existing) return;

  all[k] = {
    ...existing,
    status: "completed",
    currentSlide: existing.totalSlides - 1,
    lastAccessedAt: Date.now(),
    completedAt: Date.now(),
  };
  writeAll(all);
}

/**
 * Returns the progress record for a specific user + module, or undefined.
 */
export function getProgress(
  username: string,
  moduleId: string,
): AssessmentProgress | undefined {
  return readAll()[key(username, moduleId)];
}

/**
 * Returns the ModuleStatus for a user+module pair.
 * Falls back to "not_started" if no record exists.
 */
export function getModuleStatus(
  username: string,
  moduleId: string,
): ModuleStatus {
  return getProgress(username, moduleId)?.status ?? "not_started";
}

/**
 * Returns all progress records for a given batch (for admin view).
 */
export function getProgressForBatchLive(batchId: string): AssessmentProgress[] {
  return Object.values(readAll()).filter((p) => p.batchId === batchId);
}

/**
 * Returns all progress records for a given user.
 */
export function getProgressForUser(username: string): AssessmentProgress[] {
  return Object.values(readAll()).filter((p) => p.username === username);
}
