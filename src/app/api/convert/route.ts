/**
 * POST /api/convert
 *
 * Receives a multipart/form-data upload with a single field "file".
 * Delegates all validation and conversion to the conversion service.
 * Returns JSON with { ok, pdfUrl } on success or { ok, message } on failure.
 *
 * This route contains zero business logic — it is a thin HTTP adapter.
 */

import { convertPptToPdf, MAX_FILE_SIZE_BYTES } from "@/lib/services/conversion-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Allow Next.js to receive large file uploads up to 55 MB (service enforces 50 MB)
export const maxDuration = 120; // seconds — LibreOffice can be slow on first run

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request — expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json(
      { ok: false, message: "No file provided. Include a 'file' field in the form." },
      { status: 400 },
    );
  }

  // Guard against excessively large files at the HTTP layer before buffering
  const sizeBytes = file.size;
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        message: `File exceeds the 50 MB limit (received ${(sizeBytes / 1024 / 1024).toFixed(1)} MB).`,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await convertPptToPdf(
    buffer,
    file.name,
    file.type,
    sizeBytes,
  );

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      INVALID_TYPE: 415,
      FILE_TOO_LARGE: 413,
      LIBREOFFICE_NOT_FOUND: 503,
      CONVERSION_FAILED: 422,
      STORAGE_ERROR: 500,
    };
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: statusMap[result.code] ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    pdfUrl: result.pdfUrl,
    originalName: result.originalName,
    pageCount: result.pageCount,
  });
}
