import { requireSessionEmail } from "@/lib/api-session";
import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/activity-score
 *
 * Saves a single activity completion score to the standalone
 * prompt_activity_scores table. Does not touch any existing tables.
 *
 * Body: { moduleId, activityId, score, maxScore }
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireSessionEmail();
    if (!access.ok) return access.response;

    const body = (await req.json()) as {
      moduleId?: unknown;
      activityId?: unknown;
      score?: unknown;
      maxScore?: unknown;
    };

    const { moduleId, activityId, score, maxScore } = body;

    if (
      typeof moduleId !== "string" ||
      typeof activityId !== "string" ||
      typeof score !== "number"
    ) {
      return NextResponse.json(
        { ok: false, message: "moduleId, activityId (string) and score (number) required." },
        { status: 400 },
      );
    }

    const VALID_IDS = [
      "block-builder",
      "robot-rescue",
      "ingredient-lab",
      "sprint-challenge",
    ];
    if (!VALID_IDS.includes(activityId)) {
      return NextResponse.json(
        { ok: false, message: `Invalid activityId: ${activityId}` },
        { status: 400 },
      );
    }

    const sql = getSql();

    // Calculate next attempt number for this user + module + activity
    const rows = await sql`
      SELECT COALESCE(MAX(attempt_number), 0) AS last_attempt
      FROM prompt_activity_scores
      WHERE user_email = ${access.email}
        AND module_id  = ${moduleId}
        AND activity_id = ${activityId}
    `;
    const nextAttempt = Number((rows[0] as { last_attempt: number }).last_attempt) + 1;

    await sql`
      INSERT INTO prompt_activity_scores
        (user_email, module_id, activity_id, score, max_score, attempt_number)
      VALUES (
        ${access.email},
        ${moduleId},
        ${activityId},
        ${score},
        ${typeof maxScore === "number" ? maxScore : 25},
        ${nextAttempt}
      )
    `;

    return NextResponse.json({ ok: true, attemptNumber: nextAttempt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save activity score.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/**
 * GET /api/activity-score?moduleId=xxx
 *
 * Returns all activity scores for the current user + module
 * (latest attempt per activity).
 */
export async function GET(req: NextRequest) {
  try {
    const access = await requireSessionEmail();
    if (!access.ok) return access.response;

    const moduleId = req.nextUrl.searchParams.get("moduleId");
    if (!moduleId) {
      return NextResponse.json(
        { ok: false, message: "moduleId required" },
        { status: 400 },
      );
    }

    const sql = getSql();
    const rows = await sql`
      SELECT DISTINCT ON (activity_id)
        activity_id, score, max_score, attempt_number, completed_at
      FROM prompt_activity_scores
      WHERE user_email = ${access.email}
        AND module_id  = ${moduleId}
      ORDER BY activity_id, attempt_number DESC
    `;

    return NextResponse.json({ ok: true, scores: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch activity scores.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
