import { getSql } from "@/lib/db";
import {
  ensureProgressRow,
  listProgressForUser,
  saveSlideProgressDb,
} from "@/lib/services/progress-db-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET ?userEmail= — learner progress with scores */
export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get("userEmail");
    if (!userEmail) {
      return NextResponse.json(
        { ok: false, message: "userEmail is required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const progress = await listProgressForUser(sql, userEmail);
    return NextResponse.json({ ok: true, progress });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load progress";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/** POST — ensure progress row or update slide position */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userEmail,
      moduleId,
      moduleTitle,
      batchId,
      totalSlides,
      currentSlide,
    } = body;

    if (!userEmail || !moduleId || !moduleTitle || !batchId) {
      return NextResponse.json(
        { ok: false, message: "userEmail, moduleId, moduleTitle, batchId required." },
        { status: 400 },
      );
    }

    const sql = getSql();
    const row = await ensureProgressRow(sql, {
      userEmail,
      moduleId,
      moduleTitle,
      batchId,
      totalSlides: totalSlides ?? 1,
    });

    if (typeof currentSlide === "number") {
      await saveSlideProgressDb(sql, userEmail, moduleId, currentSlide);
    }

    return NextResponse.json({ ok: true, progress: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save progress";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
