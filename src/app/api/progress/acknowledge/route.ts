import { getSql } from "@/lib/db";
import { saveAcknowledgementDb } from "@/lib/services/progress-db-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — save learner training acknowledgement attestation */
export async function POST(req: NextRequest) {
  try {
    const { userEmail, moduleId, moduleTitle, feedbackRequired } = await req.json();
    if (!userEmail || !moduleId || !moduleTitle) {
      return NextResponse.json(
        { ok: false, message: "userEmail, moduleId, and moduleTitle are required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    await saveAcknowledgementDb(sql, {
      userEmail,
      moduleId,
      moduleTitle,
      feedbackRequired: Boolean(feedbackRequired),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save acknowledgement";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
