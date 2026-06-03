import { getSql } from "@/lib/db";
import { getBatchPerformance } from "@/lib/services/batch-performance-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const sql = getSql();
    const payload = await getBatchPerformance(sql, batchId);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load batch performance";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
