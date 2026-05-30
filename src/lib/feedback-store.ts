/**
 * feedback-store.ts
 *
 * Lightweight localStorage-backed feedback persistence.
 * Follows the same pattern as the uploaded-assessment store in mock-data.ts.
 * Key: "compliance-feedback"
 * Shape: FeedbackEntry[] (newest-first)
 */

export interface FeedbackEntry {
  id: string;           // nanoid-style: timestamp + random suffix
  userId: string;       // username (e.g. "user1@relnto.com")
  userName: string;     // same — kept for display without re-joining
  assessmentId: string;
  assessmentName: string;
  feedbackText: string;
  createdAt: number;    // Unix ms
}

const STORE_KEY = "compliance-feedback";

// ── Low-level helpers ─────────────────────────────────────────────────────────

function readAll(): FeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: FeedbackEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persists a new feedback entry. Returns the saved entry.
 */
export function submitFeedback(
  userId: string,
  assessmentId: string,
  assessmentName: string,
  feedbackText: string,
): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: generateId(),
    userId,
    userName: userId, // username IS the display name in this project
    assessmentId,
    assessmentName,
    feedbackText: feedbackText.trim(),
    createdAt: Date.now(),
  };

  const existing = readAll();
  // Prepend so newest is always first
  writeAll([entry, ...existing]);
  return entry;
}

/**
 * Returns all feedback entries, newest-first.
 */
export function getAllFeedback(): FeedbackEntry[] {
  return readAll();
}

/**
 * Returns feedback entries for a specific assessment.
 */
export function getFeedbackForAssessment(assessmentId: string): FeedbackEntry[] {
  return readAll().filter((e) => e.assessmentId === assessmentId);
}
