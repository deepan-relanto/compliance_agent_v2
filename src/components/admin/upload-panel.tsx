"use client";

/**
 * UploadPanel
 *
 * Admin workflow:
 *   1. idle       — drop-zone / file picker
 *   2. processing — converting PPT → PDF via /api/convert
 *   3. naming     — PDF ready; admin enters an assessment name
 *   4. done       — assessment saved to Neon; shown on user dashboard
 *   error         — any step failure
 *
 * Design tokens used: Card, CardHeader, CardContent, Button, Input,
 * zinc palette, #2e3192 brand, #f15a24 accent, shadow-[var(--shadow-card)].
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import type { BatchInfo } from "@/lib/mock-data";
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
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PanelState = "idle" | "processing" | "naming" | "done" | "error";

interface ConversionResult {
  pdfUrl: string;
  originalName: string;
  pageCount: number;
}

const MAX_MB = 50;
const PPT_EXTS = [".ppt", ".pptx"];
const PPT_MIME = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const PDF_EXTS = [".pdf"];
const PDF_MIME = ["application/pdf"];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileExtension(file: File): string {
  return "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
}

function isPdfFile(file: File): boolean {
  const ext = fileExtension(file);
  return PDF_EXTS.includes(ext) || PDF_MIME.includes(file.type);
}

function isPptFile(file: File): boolean {
  const ext = fileExtension(file);
  return PPT_EXTS.includes(ext) || PPT_MIME.includes(file.type);
}

function validateFile(file: File): string | null {
  if (!isPdfFile(file) && !isPptFile(file)) {
    return "Only .ppt, .pptx, and .pdf files are accepted.";
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `File exceeds the ${MAX_MB} MB limit (${formatBytes(file.size)}).`;
  }
  return null;
}

function displayPdfName(originalName: string): string {
  return originalName.replace(/\.(pptx?|pdf)$/i, ".pdf");
}

function guessAssessmentName(originalName: string): string {
  return originalName.replace(/\.(pptx?|pdf)$/i, "").replace(/[-_]/g, " ");
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
      aria-label="Upload PPT, PPTX, or PDF file"
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
          Accepted: .ppt, .pptx, .pdf · Max {MAX_MB} MB
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          PDF files are stored directly — no conversion step.
        </p>
      </div>
      <input
        ref={inputRef}
        id="ppt-file-input"
        type="file"
        accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
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

const STEPS = ["Upload file", "Prepare PDF", "Create assessment"] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="flex w-full items-center gap-0">
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

function mapBatch(row: Record<string, unknown>): BatchInfo {
  return {
    id: row.id as string,
    label: row.label as string,
    description: (row.description as string) ?? "",
    memberCount: Number(row.member_count ?? row.memberCount ?? 0),
    compliance: Number(row.compliance ?? 0),
    passRate: Number(row.pass_rate ?? row.passRate ?? 0),
    failRate: Number(row.fail_rate ?? row.failRate ?? 0),
    activeSessions: Number(row.active_sessions ?? row.activeSessions ?? 0),
  };
}

export function UploadPanel() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<PanelState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [assessmentName, setAssessmentName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState("");
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [assignedBatches, setAssignedBatches] = useState<string[]>([]);
  const [skippedConversion, setSkippedConversion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mcqCountCreated, setMcqCountCreated] = useState(0);
  const [questionsReused, setQuestionsReused] = useState(false);

  const isProcessing = state === "processing";
  const fileIsPdf = file ? isPdfFile(file) : false;

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.batches)) {
          setBatches(data.batches.map(mapBatch));
        }
      })
      .catch(() => undefined);
  }, []);

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId],
    );
    setBatchError(null);
  };

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
    setSkippedConversion(false);
  }

  function handleReset() {
    setFile(null);
    setValidationError(null);
    setServerError(null);
    setConversionResult(null);
    setAssessmentName("");
    setNameError(null);
    setState("idle");
    setSkippedConversion(false);
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

      setAssessmentName(guessAssessmentName(json.originalName));
      setSkippedConversion(Boolean(json.skippedConversion));
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

  async function handleCreateAssessment() {
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
    if (selectedBatchIds.length === 0) {
      setBatchError("Select at least one batch to assign this assessment.");
      return;
    }
    setNameError(null);
    setBatchError(null);
    setPublishError(null);
    setPublishing(true);

    const id = makeAssessmentId(trimmedName);
    const description = `Uploaded from ${conversionResult.originalName}`;

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: trimmedName,
          description,
          slideCount: conversionResult.pageCount,
          durationMinutes: 20,
          pdfUrl: conversionResult.pdfUrl,
          batchIds: selectedBatchIds,
          uploadedBy: user?.username ?? "admin@relnto.com",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPublishError(json.message ?? "Could not save assessment to the database.");
        return;
      }

      const labels = batches
        .filter((b) => selectedBatchIds.includes(b.id))
        .map((b) => b.label);
      setAssignedBatches(labels);
      setCreatedTitle(trimmedName);
      setMcqCountCreated(json.mcqCount ?? 0);
      setQuestionsReused(Boolean(json.reused));
      setState("done");
    } catch {
      setPublishError("Could not reach the server. Check DATABASE_URL and NVIDIA_API_KEY.");
    } finally {
      setPublishing(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-6">
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
                  Upload training file
                </h2>
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2e3192]" />
                  {fileIsPdf ? "Uploading PDF…" : "Converting…"}
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
                      {fileIsPdf ? "Uploading PDF…" : "Convert to PDF…"}
                    </>
                  ) : fileIsPdf ? (
                    "Continue with PDF"
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
                  {displayPdfName(conversionResult.originalName)}
                </p>
                <p className="text-xs text-zinc-400">
                  {conversionResult.pageCount} page{conversionResult.pageCount === 1 ? "" : "s"}
                  {skippedConversion ? " · uploaded as-is" : " · converted from PowerPoint"}
                </p>
              </div>
              <a
                href={conversionResult.pdfUrl}
                download={displayPdfName(conversionResult.originalName)}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#2e3192]"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>

            {/* Batch assignment */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Assign to batches</p>
              {batches.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Loading batches… run <code>npm run db:seed</code> if none appear.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {batches.map((batch) => {
                    const checked = selectedBatchIds.includes(batch.id);
                    return (
                      <label
                        key={batch.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-[#2e3192]/40 bg-[#2e3192]/5"
                            : "border-zinc-200 bg-white hover:border-zinc-300",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBatch(batch.id)}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#2e3192]"
                        />
                        <span>
                          <span className="font-medium text-zinc-800">{batch.label}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {batch.memberCount} learners
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {batchError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {batchError}
                </p>
              )}
            </div>

            {publishError && <InlineAlert type="error" message={publishError} />}

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
                disabled={publishing}
                onClick={handleCreateAssessment}
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating checkpoint questions…
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    Create Assessment
                  </>
                )}
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
              Published to:{" "}
              <span className="font-medium text-zinc-700">
                {assignedBatches.length > 0 ? assignedBatches.join(", ") : "selected batches"}
              </span>
              . {mcqCountCreated} checkpoint
              {mcqCountCreated === 1 ? "" : "s"}
              {questionsReused
                ? " reused from matching PDF (no new LLM run)."
                : " generated via NVIDIA LLM."}
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

      {/* ── Info note (mobile) ───────────────────────────────────────────── */}
      {state !== "done" && (
        <p className="text-xs text-zinc-400 lg:hidden">
          PPT/PPTX uses LibreOffice; PDF uploads skip conversion. Files live in{" "}
          <code className="text-zinc-500">public/uploads/</code>.
        </p>
      )}
        </div>

        {/* ── Sidebar help ───────────────────────────────────────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-md border border-zinc-200 bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Pipeline guide
            </p>
            <ul className="space-y-3 text-sm text-zinc-600">
              <li className="flex gap-2">
                <span className="font-semibold text-[#2e3192]">1.</span>
                Upload .ppt, .pptx, or .pdf (max {MAX_MB} MB).
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#2e3192]">2.</span>
                PPT converts via LibreOffice; PDF is stored as-is.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#2e3192]">3.</span>
                Name the assessment — NVIDIA generates one MCQ per 3 slides.
              </li>
            </ul>
            <div className="border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">
              Files live in <code className="text-zinc-600">public/uploads/</code>.
              Choose one or more batches before publishing. Metadata and MCQ gates
              are stored in Neon.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
