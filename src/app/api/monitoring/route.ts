import { getSql } from "@/lib/db";
import {
  getMonitoringSummary,
  listMonitoringViolationsPaged,
  listMonitoringReviewsPaged,
  listMonitoringAuditLogsPaged,
} from "@/lib/services/monitoring-db-service";
import { cacheGet, cacheSet, CACHE_KEYS } from "@/lib/api-cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * GET /api/monitoring
 *   ?tab=violations|reviews|audit   (default: violations)
 *   ?page=N                         (default: 1)
 *   ?pageSize=N                     (default: 25, max: 100)
 *   ?summary=1                      (return only KPI summary)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") ?? "violations") as
      | "violations"
      | "reviews"
      | "audit";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10)),
    );
    const summaryOnly = searchParams.get("summary") === "1";

    const sql = getSql();

    // ── Summary-only request (KPI cards) ──────────────────────────────────────
    if (summaryOnly) {
      const cacheKey = CACHE_KEYS.monitoringSummary;
      const cached = cacheGet<object>(cacheKey);
      if (cached) return NextResponse.json({ ok: true, ...cached });

      const summary = await getMonitoringSummary(sql);
      cacheSet(cacheKey, summary, 30);
      return NextResponse.json({ ok: true, ...summary });
    }

    // ── Tab data request ──────────────────────────────────────────────────────
    if (tab === "violations") {
      const cacheKey = CACHE_KEYS.monitoringViolations(page);
      const cached = cacheGet<object>(cacheKey);
      if (cached) return NextResponse.json({ ok: true, ...cached });

      const data = await listMonitoringViolationsPaged(sql, page, pageSize);
      cacheSet(cacheKey, data, 30);
      return NextResponse.json({ ok: true, ...data, page, pageSize });
    }

    if (tab === "reviews") {
      const cacheKey = CACHE_KEYS.monitoringReviews(page);
      const cached = cacheGet<object>(cacheKey);
      if (cached) return NextResponse.json({ ok: true, ...cached });

      const data = await listMonitoringReviewsPaged(sql, page, pageSize);
      cacheSet(cacheKey, data, 30);
      return NextResponse.json({ ok: true, ...data, page, pageSize });
    }

    if (tab === "audit") {
      const cacheKey = CACHE_KEYS.monitoringAudit(page);
      const cached = cacheGet<object>(cacheKey);
      if (cached) return NextResponse.json({ ok: true, ...cached });

      const data = await listMonitoringAuditLogsPaged(sql, page, pageSize);
      cacheSet(cacheKey, data, 30);
      return NextResponse.json({ ok: true, ...data, page, pageSize });
    }

    return NextResponse.json({ ok: false, error: "Invalid tab" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load monitoring data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
