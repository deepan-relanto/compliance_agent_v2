/**
 * conversion-service.ts
 *
 * Dedicated service layer for PPT/PPTX → PDF conversion.
 * The API route calls `convertPptToPdf()` and knows nothing about
 * LibreOffice, file paths, or child processes.
 *
 * To swap the provider (CloudConvert, MS Graph, etc.) in the future,
 * replace `runLibreOfficeConversion()` without touching anything else.
 */

import { exec } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Constants ────────────────────────────────────────────────────────────────

/** 50 MB upload limit */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const ALLOWED_EXTENSIONS = [".ppt", ".pptx"];

/** Where uploaded PPT files and generated PDFs are stored */
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionResult {
  ok: true;
  pdfUrl: string;   // Public URL for browser download, e.g. /uploads/abc123.pdf
  pdfPath: string;  // Absolute FS path — useful for future storage providers
  originalName: string;
}

export interface ConversionError {
  ok: false;
  code:
    | "INVALID_TYPE"
    | "FILE_TOO_LARGE"
    | "LIBREOFFICE_NOT_FOUND"
    | "CONVERSION_FAILED"
    | "STORAGE_ERROR";
  message: string;
}

export type ConversionOutcome = ConversionResult | ConversionError;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensures the uploads directory exists before writing to it. */
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Sanitizes an uploaded filename so it cannot escape the uploads directory.
 * Strips path separators and non-printable characters.
 */
function sanitizeFilename(raw: string): string {
  return path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Detects the LibreOffice executable on Windows and Linux/macOS.
 * Returns the full path to soffice, or null if not found.
 */
function detectLibreOffice(): string | null {
  const candidates = [
    // Windows – standard install locations
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    // Linux / macOS / Docker
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// ─── Core Conversion (Provider) ───────────────────────────────────────────────

/**
 * Runs LibreOffice headless to convert pptPath → PDF in the same directory.
 * Returns the generated PDF path.
 *
 * Replace this function to switch conversion providers.
 */
async function runLibreOfficeConversion(
  sofficePath: string,
  pptPath: string,
  outputDir: string,
): Promise<string> {
  const cmd = `"${sofficePath}" --headless --convert-to pdf "${pptPath}" --outdir "${outputDir}"`;

  console.log(`[conversion-service] Running: ${cmd}`);

  const { stdout, stderr } = await execAsync(cmd, { timeout: 120_000 });

  if (stdout) console.log(`[conversion-service] stdout: ${stdout}`);
  if (stderr) console.log(`[conversion-service] stderr: ${stderr}`);

  // LibreOffice outputs the generated file as <basename>.pdf
  const pdfPath = path.join(
    outputDir,
    path.basename(pptPath, path.extname(pptPath)) + ".pdf",
  );

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`LibreOffice ran but output PDF was not created at: ${pdfPath}`);
  }

  return pdfPath;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates, stores, converts, and returns a download URL for the PDF.
 *
 * @param buffer   Raw bytes of the uploaded file
 * @param originalName  Original filename from the client
 * @param mimeType  MIME type reported by the browser
 * @param sizeBytes  File size in bytes (used for early validation)
 */
export async function convertPptToPdf(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<ConversionOutcome> {
  // ── 1. Validate file type ────────────────────────────────────────────────
  const ext = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      ok: false,
      code: "INVALID_TYPE",
      message: "Only .ppt and .pptx files are accepted.",
    };
  }

  // ── 2. Validate file size ────────────────────────────────────────────────
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File exceeds the 50 MB limit (received ${(sizeBytes / 1024 / 1024).toFixed(1)} MB).`,
    };
  }

  // ── 3. Detect LibreOffice ────────────────────────────────────────────────
  const sofficePath = detectLibreOffice();
  if (!sofficePath) {
    return {
      ok: false,
      code: "LIBREOFFICE_NOT_FOUND",
      message:
        "LibreOffice is not installed or could not be found. Please install LibreOffice and restart the server.",
    };
  }

  // ── 4. Store the uploaded file safely ────────────────────────────────────
  let pptPath: string;
  try {
    ensureUploadsDir();
    const uid = crypto.randomUUID();
    const safeName = sanitizeFilename(originalName);
    const storedName = `${uid}_${safeName}`;
    pptPath = path.join(UPLOADS_DIR, storedName);
    fs.writeFileSync(pptPath, buffer);
    console.log(`[conversion-service] Saved upload: ${pptPath}`);
  } catch (err) {
    console.error("[conversion-service] Storage error:", err);
    return {
      ok: false,
      code: "STORAGE_ERROR",
      message: "Failed to save the uploaded file. Check server storage permissions.",
    };
  }

  // ── 5. Convert to PDF ─────────────────────────────────────────────────────
  let rawPdfPath: string;
  try {
    rawPdfPath = await runLibreOfficeConversion(sofficePath, pptPath, UPLOADS_DIR);
  } catch (err) {
    console.error("[conversion-service] Conversion error:", err);
    // Clean up the orphaned PPT file
    fs.rmSync(pptPath, { force: true });
    return {
      ok: false,
      code: "CONVERSION_FAILED",
      message:
        "LibreOffice could not convert the file. Ensure the file is a valid, uncorrupted PPT/PPTX.",
    };
  }

  // ── 6. Rename PDF to a clean UUID-based name ──────────────────────────────
  const finalPdfName = `${crypto.randomUUID()}.pdf`;
  const finalPdfPath = path.join(UPLOADS_DIR, finalPdfName);
  try {
    fs.renameSync(rawPdfPath, finalPdfPath);
  } catch (err) {
    console.error("[conversion-service] Rename error:", err);
    return {
      ok: false,
      code: "STORAGE_ERROR",
      message: "Conversion succeeded but the output file could not be saved.",
    };
  }

  console.log(`[conversion-service] PDF ready: ${finalPdfPath}`);

  return {
    ok: true,
    pdfUrl: `/uploads/${finalPdfName}`,
    pdfPath: finalPdfPath,
    originalName,
  };
}
