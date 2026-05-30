"use client";

/**
 * UploadPanel
 *
 * Admin workflow:
 *   1. idle       — drop-zone / file picker
 *   2. processing — converting PPT → PDF via /api/convert
 *   3. naming     — PDF ready; admin enters an assessment name
 *   4. done       — assessment saved to localStorage; shown on user dashboard
 *   error         — any step failure
 *
 * Design tokens used: Card, CardHeader, CardContent, Button, Input,
 * zinc palette, #2e3192 brand, #f15a24 accent, shadow-[var(--shadow-card)].
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveUploadedAssessment } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Loader2,
  RefreshCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PanelState = "idle" | "processing" | "naming" | "done" | "error";

interface ConversionResult {
  pdfUrl: string;
  originalName: string;
  pageCount: number;
}

const MAX_MB = 50;
const ALLOWED_EXTS = [".ppt", ".pptx"];
const ALLOWED_MIME = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
    return "Only .ppt and .pptx files are accepted.";
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `File exceeds the ${MAX_MB} MB limit (${formatBytes(file.size)}).`;
  }
  return null;
}

/** Generates a URL-safe id from an assessment name + timestamp */
function makeAssessmentId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36)
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files[0]) onFile(files[0]);
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload PPT or PPTX file"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-8 py-14 text-center transition-colors",
        dragging
          ? "border-[#2e3192] bg-[#2e3192]/5"
          : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100/60",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#2e3192]/8">
        <UploadCloud className="h-6 w-6 text-[#2e3192]" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-700">
          Drag &amp; drop your file here, or{" "}
          <span className="text-[#2e3192] underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Accepted: .ppt, .pptx · Max {MAX_MB} MB
        </p>
      </div>
      <input
        ref={inputRef}
        id="ppt-file-input"
        type="file"
        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
    </div>
  );
}

function FileChip({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#2e3192]/8">
        <FileText className="h-4 w-4 text-[#2e3192]" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{file.name}</p>
        <p className="text-xs text-zinc-400">{formatBytes(file.size)}</p>
      </div>
      {!disabled && (
        <button
          id="remove-file-btn"
          onClick={onRemove}
          aria-label="Remove file"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function InlineAlert({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const isError = type === "error";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      )}
      <span>{message}</span>
    </div>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ["Upload file", "Convert to PDF", "Create assessment"] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-[#2e3192] bg-[#2e3192] text-white"
                      : "border-zinc-200 bg-white text-zinc-400",
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> : i + 1}
              </div>
              <span
                className={cn(
                  "mt-1.5 whitespace-nowrap text-[11px] font-medium",
                  active ? "text-zinc-800" : done ? "text-emerald-600" : "text-zinc-400",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-px flex-1 transition-colors",
                  done ? "bg-emerald-400" : "bg-zinc-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function UploadPanel() {
  const [state, setState] = useState<PanelState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [assessmentName, setAssessmentName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState("");

  const isProcessing = state === "processing";

  // ── Step index for the indicator ────────────────────────────────────────
  const stepIndex: 0 | 1 | 2 =
    state === "idle" || state === "error" ? 0
    : state === "processing" ? 1
    : 2; // naming | done

  function handleFileSelect(selected: File) {
    const err = validateFile(selected);
    if (err) {
      setValidationError(err);
      setFile(null);
      return;
    }
    setValidationError(null);
    setServerError(null);
    setFile(selected);
    setState("idle");
    setConversionResult(null);
  }

  function handleReset() {
    setFile(null);
    setValidationError(null);
    setServerError(null);
    setConversionResult(null);
    setAssessmentName("");
    setNameError(null);
    setState("idle");
  }

  async function handleConvert() {
    if (!file || isProcessing) return;
    const err = validateFile(file);
    if (err) { setValidationError(err); return; }

    setState("processing");
    setServerError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/convert", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setServerError(json.message ?? "An unexpected error occurred.");
        setState("error");
        return;
      }

      // Pre-fill the assessment name from the original filename (no extension)
      const guessedName = json.originalName.replace(/\.pptx?$/i, "").replace(/[-_]/g, " ");
      setAssessmentName(guessedName);
      setConversionResult({
        pdfUrl: json.pdfUrl,
        originalName: json.originalName,
        pageCount: typeof json.pageCount === "number" && json.pageCount > 0
          ? json.pageCount
          : 1,
      });
      setState("naming");
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  function handleCreateAssessment() {
    if (!conversionResult) return;

    const trimmedName = assessmentName.trim();
    if (!trimmedName) {
      setNameError("Please enter an assessment name.");
      return;
    }
    if (trimmedName.length < 3) {
      setNameError("Name must be at least 3 characters.");
      return;
    }
    setNameError(null);

    // Build the TrainingModule record and persist it to localStorage
    const id = makeAssessmentId(trimmedName);
    const now = Date.now();
    saveUploadedAssessment({
      id,
      title: trimmedName,
      description: `Uploaded from ${conversionResult.originalName}`,
      // Use the real PDF page count returned by the conversion API.
      slideCount: conversionResult.pageCount,
      durationMinutes: 20,
      status: "not_started",
      batchIds: ["all"],
      pdfUrl: conversionResult.pdfUrl,
      contentType: "pdf",
      createdAt: now,
    });

    setCreatedTitle(trimmedName);
    setState("done");
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Step indicator (hidden in final done state) ─────────────────── */}
      {state !== "done" && <StepIndicator current={stepIndex} />}

      {/* ── Upload / Convert card (steps 1 & 2) ────────────────────────── */}
      {(state === "idle" || state === "processing" || state === "error") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Content Pipeline
                </p>
                <h2 className="mt-1 text-base font-semibold text-zinc-900">
                  Upload PowerPoint File
                </h2>
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2e3192]" />
                  Converting…
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!file && (
              <DropZone onFile={handleFileSelect} disabled={isProcessing} />
            )}

            {validationError && (
              <InlineAlert type="error" message={validationError} />
            )}
            {serverError && state === "error" && (
              <InlineAlert type="error" message={serverError} />
            )}

            {file && (
              <FileChip file={file} onRemove={handleReset} disabled={isProcessing} />
            )}

            {file && (
              <div className="flex items-center gap-3 pt-1">
                <Button
                  id="convert-btn"
                  variant="primary"
                  size="md"
                  disabled={isProcessing}
                  onClick={handleConvert}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Converting to PDF…
                    </>
                  ) : (
                    "Convert to PDF"
                  )}
                </Button>
                {!isProcessing && (
                  <Button id="cancel-btn" variant="ghost" size="md" onClick={handleReset}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Naming card (step 3) ────────────────────────────────────────── */}
      {state === "naming" && conversionResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
                  Conversion complete
                </p>
                <h2 className="text-base font-semibold text-zinc-900">
                  Name your assessment
                </h2>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Converted file summary */}
            <div className="flex items-center gap-3 rounded-md border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-800">
                  {conversionResult.originalName.replace(/\.pptx?$/i, ".pdf")}
                </p>
                <p className="text-xs text-zinc-400">PDF ready</p>
              </div>
              <a
                href={conversionResult.pdfUrl}
                download={conversionResult.originalName.replace(/\.pptx?$/i, ".pdf")}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#2e3192]"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>

            {/* Assessment name field */}
            <div className="space-y-1.5">
              <label
                htmlFor="assessment-name-input"
                className="block text-sm font-medium text-zinc-700"
              >
                Assessment name
              </label>
              <Input
                id="assessment-name-input"
                placeholder="e.g. Q3 Security Compliance"
                value={assessmentName}
                onChange={(e) => {
                  setAssessmentName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAssessment()}
                autoFocus
              />
              {nameError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {nameError}
                </p>
              )}
              <p className="text-xs text-zinc-400">
                This name will appear on the user dashboard alongside existing modules.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                id="create-assessment-btn"
                variant="primary"
                size="md"
                onClick={handleCreateAssessment}
              >
                <Layers className="h-3.5 w-3.5" />
                Create Assessment
              </Button>
              <Button
                id="back-to-upload-btn"
                variant="ghost"
                size="md"
                onClick={handleReset}
              >
                Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Done card ──────────────────────────────────────────────────────── */}
      {state === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Assessment created
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">
              {createdTitle}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
              The assessment has been published and will appear on the user dashboard
              under all batches. Users can start it immediately.
            </p>
            <Button
              id="upload-another-btn"
              variant="secondary"
              size="lg"
              className="mt-8"
              onClick={handleReset}
            >
              <RefreshCcw className="h-4 w-4" />
              Upload another file
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Info note ──────────────────────────────────────────────────────── */}
      {state !== "done" && (
        <p className="text-xs text-zinc-400">
          Conversion uses LibreOffice locally. Files are stored in{" "}
          <code className="text-zinc-500">public/uploads/</code>. Batch assignment
          and approval workflows will be available in a future release.
        </p>
      )}
    </div>
  );
}
