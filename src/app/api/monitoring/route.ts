import { getSql } from "@/lib/db";
import { getMonitoringPayload } from "@/lib/services/monitoring-db-service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET — violations, review requests, and audit logs for admin monitoring */
export async function GET() {
  try {
    const sql = getSql();
    const data = await getMonitoringPayload(sql);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load monitoring data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
