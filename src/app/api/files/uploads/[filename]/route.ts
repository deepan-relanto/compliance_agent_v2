import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const UPLOAD_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!UPLOAD_FILENAME.test(filename)) {
    return NextResponse.json({ ok: false, message: "Invalid file." }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, message: "PDF not found." }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
