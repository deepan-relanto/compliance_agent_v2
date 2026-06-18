import { requireLearnerModuleAccess } from "@/lib/api-session";
import { getSql } from "@/lib/db";
import { markAssessmentCompletedDb } from "@/lib/services/progress-db-service";
import { sendModuleCompletionEmail } from "@/lib/services/training-notification-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — mark assessment completed after feedback (acknowledgement already saved). */
export async function POST(req: NextRequest) {
  try {
    const { userEmail, moduleId } = await req.json();
    if (!moduleId) {
      return NextResponse.json(
        { ok: false, message: "moduleId is required." },
        { status: 400 },
      );
    }

    const access = await requireLearnerModuleAccess(moduleId, userEmail);
    if (!access.ok) return access.response;

    const sql = getSql();
    await markAssessmentCompletedDb(sql, access.email, moduleId);

    void sendModuleCompletionEmail(sql, access.email, moduleId).catch((err) => {
      console.error("[progress complete email]", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete assessment";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
