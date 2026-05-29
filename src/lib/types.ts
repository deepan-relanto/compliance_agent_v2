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

export type ModuleStatus = "not_started" | "in_progress" | "completed";

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
