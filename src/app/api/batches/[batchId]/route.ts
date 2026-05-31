import { getSql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const sql = getSql();

    const batchRows = await sql`
      SELECT id, label, description, member_count, compliance, pass_rate, fail_rate, active_sessions
      FROM batches WHERE id = ${batchId} LIMIT 1
    `;
    if (batchRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
    }

    const b = batchRows[0];
    const users = await sql`
      SELECT email, display_name, role
      FROM users
      WHERE batch_id = ${batchId}
      ORDER BY email
    `;

    return NextResponse.json({
      ok: true,
      batch: {
        id: b.id,
        label: b.label,
        description: b.description,
        memberCount: b.member_count,
        compliance: b.compliance,
        passRate: b.pass_rate,
        failRate: b.fail_rate,
        activeSessions: b.active_sessions,
      },
      users: users.map((u) => ({
        email: u.email,
        displayName: u.display_name ?? u.email,
        role: u.role,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load batch";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
