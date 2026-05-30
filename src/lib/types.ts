export type UserRole = "admin" | "user";

export interface AuthUser {
  username: string;
  role: UserRole;
  batchId: string;
}

export interface CsvUserRow {
  username: string;
  password: string;
  role: UserRole;
  batch_id: string;
}

export type ModuleStatus = "not_started" | "in_progress" | "completed" | "failed" | "permanently_failed";

export interface WarningHistoryEntry {
  reason: string;
  timestamp: number; // Unix ms
}

export interface ReviewRequest {
  id: string;
  username: string;
  moduleId: string;
  moduleTitle: string;
  warningCount: number;
  failureTimestamp: number;
  userExplanation: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedTimestamp: number;
  decisionTimestamp?: number;
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  adminComment?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  admin: string;
  timestamp: number;
  details?: string;
}

/** 'text' = existing demo slides   'pdf' = uploaded PDF assessment */
export type ContentType = "text" | "pdf";

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  slideCount: number;
  durationMinutes: number;
  status: ModuleStatus;
  batchIds: string[];
  /** Present when contentType === 'pdf'. Public URL served from /uploads/ */
  pdfUrl?: string;
  /** Defaults to 'text' for all existing demo modules. */
  contentType?: ContentType;
  /** Unix ms timestamp — used to sort uploaded assessments newest-first. */
  createdAt?: number;
}

export interface McqOption {
  id: string;
  label: string;
}

export interface McqQuestion {
  id: string;
  slideIndex: number;
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
}

export interface EmployeeProgress {
  username: string;
  batchId: string;
  moduleId: string;
  moduleTitle: string;
  progressPercent: number;
  mcqPassRate: number;
  timeSpentMinutes: number;
  status: ModuleStatus;
}

// Re-export store types so consumers can import from a single @/lib/types
export type { AssessmentProgress } from "./progress-store";
export type { FeedbackEntry } from "./feedback-store";

