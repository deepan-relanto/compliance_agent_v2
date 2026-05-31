import { getSql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, label, description, member_count, compliance, pass_rate, fail_rate, active_sessions
      FROM batches
      ORDER BY label
    `;
    return NextResponse.json({ ok: true, batches: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load batches";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
