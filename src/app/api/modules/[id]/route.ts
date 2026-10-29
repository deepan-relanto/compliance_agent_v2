import { requireLearnerModuleAccess } from "@/lib/api-session";
import { getSql } from "@/lib/db";
import { cacheGetSWR, cacheSet, CACHE_KEYS } from "@/lib/api-cache";
import { loadModuleDetail } from "@/lib/services/module-detail-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const claimedEmail = req.nextUrl.searchParams.get("userEmail");
    const intendedEmail = req.nextUrl.searchParams.get("forEmail");
    const access = await requireLearnerModuleAccess(id, claimedEmail, intendedEmail);
    if (!access.ok) return access.response;

    const isPreviewOrFresh =
      req.nextUrl.searchParams.get("preview") === "1" ||
      req.nextUrl.searchParams.get("fresh") === "1";

    const cacheKey = CACHE_KEYS.moduleDetail(id, access.email);
    const cached = !isPreviewOrFresh ? cacheGetSWR<object>(cacheKey) : null;
    if (cached) {
      if (!cached.fresh) {
        queueMicrotask(() => {
          void (async () => {
            try {
              const sql = getSql();
              const detail = await loadModuleDetail(sql, id, access.email);
              if (detail) {
                cacheSet(
                  cacheKey,
                  {
                    module: detail.module,
                    mcqs: detail.mcqs,
                    steps: detail.steps ?? [],
                    resumeCheckpoint: detail.resumeCheckpoint ?? null,
                  },
                  30,
                  90,
                );
              }
            } catch {
              /* ignore */
            }
          })();
        });
      }
      return NextResponse.json(
        { ok: true, ...cached.data },
        {
          headers: {
            "X-Cache": cached.fresh ? "HIT" : "STALE",
            "Cache-Control": "private, no-cache",
          },
        },
      );
    }

    const sql = getSql();
    const detail = await loadModuleDetail(sql, id, access.email);

    if (!detail) {
      return NextResponse.json({ ok: false, error: "Module not found" }, { status: 404 });
    }

    const payload = {
      module: detail.module,
      mcqs: detail.mcqs,
      steps: detail.steps ?? [],
      resumeCheckpoint: detail.resumeCheckpoint ?? null,
    };
    cacheSet(cacheKey, payload, 30, 90);

    return NextResponse.json(
      { ok: true, ...payload },
      { headers: { "X-Cache": "MISS", "Cache-Control": "private, no-cache" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load module";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
