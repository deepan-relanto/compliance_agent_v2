import { getSql } from "@/lib/db";
import { markAssessmentCompletedDb } from "@/lib/services/progress-db-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — mark assessment completed after feedback (acknowledgement already saved). */
export async function POST(req: NextRequest) {
  try {
    const { userEmail, moduleId } = await req.json();
    if (!userEmail || !moduleId) {
      return NextResponse.json(
        { ok: false, message: "userEmail and moduleId are required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    await markAssessmentCompletedDb(sql, userEmail, moduleId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to complete assessment";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
