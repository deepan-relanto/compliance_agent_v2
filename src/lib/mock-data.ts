import type { EmployeeProgress, McqQuestion, TrainingModule } from "./types";

/** Dummy CSV for client-side auth — replace with API later */
export const AUTH_CSV = `username,password,role,batch_id
admin@relnto.com,admin123,admin,
user1@relnto.com,user123,user,batch_a
user2@relnto.com,user123,user,batch_a
user3@relnto.com,user123,user,batch_b`;

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: "q3-security",
    title: "Q3 Security Compliance",
    description:
      "Mandatory quarterly review of data handling, access controls, and incident reporting.",
    slideCount: 12,
    durationMinutes: 25,
    status: "in_progress",
    batchIds: ["batch_a", "batch_b"],
  },
  {
    id: "phishing-basics",
    title: "Phishing Basics",
    description:
      "Recognize social-engineering tactics, verify senders, and report suspicious messages.",
    slideCount: 9,
    durationMinutes: 18,
    status: "not_started",
    batchIds: ["batch_a", "batch_b"],
  },
  {
    id: "gdpr-refresh",
    title: "GDPR Refresher 2026",
    description:
      "Processing lawful bases, subject rights, and cross-border transfer obligations.",
    slideCount: 15,
    durationMinutes: 30,
    status: "completed",
    batchIds: ["batch_a"],
  },
  {
    id: "workplace-safety",
    title: "Workplace Safety Protocol",
    description:
      "Emergency procedures, ergonomic standards, and hazard identification on site.",
    slideCount: 10,
    durationMinutes: 20,
    status: "not_started",
    batchIds: ["batch_b"],
  },
];

export const SLIDE_CONTENT: Record<string, string[]> = {
  "q3-security": [
    "Security Posture Overview",
    "Access Control Principles",
    "Password & MFA Standards",
    "Data Classification Tiers",
    "Incident Response Workflow",
    "Phishing & Social Engineering",
    "Remote Work Safeguards",
    "Vendor Risk Management",
    "Audit Logging Requirements",
    "Employee Responsibilities",
    "Reporting Channels",
    "Q3 Compliance Summary",
  ],
  "phishing-basics": [
    "What Is Phishing?",
    "Common Attack Vectors",
    "Red Flags in Email",
    "URL & Attachment Safety",
    "Spear Phishing vs Bulk",
    "Verification Best Practices",
    "Reporting Procedures",
    "Case Study Walkthrough",
    "Knowledge Check Prep",
  ],
  "gdpr-refresh": Array.from({ length: 15 }, (_, i) => `GDPR Module — Section ${i + 1}`),
  "workplace-safety": Array.from({ length: 10 }, (_, i) => `Safety Module — Section ${i + 1}`),
};

export const MOCK_MCQS: Record<string, McqQuestion[]> = {
  "q3-security": [
    {
      id: "mcq-1",
      slideIndex: 3,
      prompt: "Which control best enforces least-privilege access?",
      options: [
        { id: "a", label: "Shared admin credentials for speed" },
        { id: "b", label: "Role-based access with periodic reviews" },
        { id: "c", label: "Public dashboards for transparency" },
        { id: "d", label: "Disabling MFA for internal tools" },
      ],
      correctOptionId: "b",
    },
    {
      id: "mcq-2",
      slideIndex: 6,
      prompt: "When must a security incident be escalated?",
      options: [
        { id: "a", label: "Only after customer complaints" },
        { id: "b", label: "Within defined SLA after suspected breach" },
        { id: "c", label: "At the end of the fiscal quarter" },
        { id: "d", label: "Never — handle locally only" },
      ],
      correctOptionId: "b",
    },
    {
      id: "mcq-3",
      slideIndex: 9,
      prompt: "Audit logs should be:",
      options: [
        { id: "a", label: "Editable by all employees" },
        { id: "b", label: "Tamper-evident and retained per policy" },
        { id: "c", label: "Deleted weekly to save storage" },
        { id: "d", label: "Optional for non-production systems" },
      ],
      correctOptionId: "b",
    },
  ],
  "phishing-basics": [
    {
      id: "mcq-p1",
      slideIndex: 3,
      prompt: "A suspicious email asks you to reset your password via an unknown link. You should:",
      options: [
        { id: "a", label: "Click immediately to stay secure" },
        { id: "b", label: "Reply with your credentials" },
        { id: "c", label: "Use official channels and report the email" },
        { id: "d", label: "Forward to all colleagues as a warning" },
      ],
      correctOptionId: "c",
    },
  ],
};

export const EMPLOYEE_PROGRESS: EmployeeProgress[] = [
  {
    username: "user1@relnto.com",
    batchId: "batch_a",
    moduleId: "q3-security",
    moduleTitle: "Q3 Security Compliance",
    progressPercent: 58,
    mcqPassRate: 100,
    timeSpentMinutes: 14,
    status: "in_progress",
  },
  {
    username: "user1@relnto.com",
    batchId: "batch_a",
    moduleId: "phishing-basics",
    moduleTitle: "Phishing Basics",
    progressPercent: 0,
    mcqPassRate: 0,
    timeSpentMinutes: 0,
    status: "not_started",
  },
  {
    username: "user2@relnto.com",
    batchId: "batch_a",
    moduleId: "q3-security",
    moduleTitle: "Q3 Security Compliance",
    progressPercent: 92,
    mcqPassRate: 67,
    timeSpentMinutes: 22,
    status: "in_progress",
  },
  {
    username: "user2@relnto.com",
    batchId: "batch_a",
    moduleId: "gdpr-refresh",
    moduleTitle: "GDPR Refresher 2026",
    progressPercent: 100,
    mcqPassRate: 100,
    timeSpentMinutes: 28,
    status: "completed",
  },
  {
    username: "user3@relnto.com",
    batchId: "batch_b",
    moduleId: "q3-security",
    moduleTitle: "Q3 Security Compliance",
    progressPercent: 25,
    mcqPassRate: 50,
    timeSpentMinutes: 8,
    status: "in_progress",
  },
  {
    username: "user3@relnto.com",
    batchId: "batch_b",
    moduleId: "workplace-safety",
    moduleTitle: "Workplace Safety Protocol",
    progressPercent: 0,
    mcqPassRate: 0,
    timeSpentMinutes: 0,
    status: "not_started",
  },
];

export const AI_REPORT_MOCK = `## Compliance Intelligence — May 2026

**Batch A (batch_a)** is performing above baseline with 78% aggregate completion. However, **Phishing Basics** shows early friction: 2 of 3 learners have not started, suggesting assignment timing or comms gaps rather than content difficulty.

**Batch B (batch_b)** is struggling with **Q3 Security Compliance**. Learners averaging **2.4 MCQ attempts** on Slide 6 checkpoints (Incident Response). Recommend a 5-minute live recap before the next mandated session.

**Qualitative Q&A themes** (last 7 days):
- Confusion around MFA enrollment on personal devices (4 mentions)
- Clarification on vendor risk escalation paths (2 mentions)

**Recommended actions:**
1. Push a supplemental MCQ on incident SLAs to Batch B via Live Control.
2. Schedule a batch-wide slide sync at Slide 6 for Batch B active sessions.
3. Export CSV for audit trail before Friday cutoff.`;

export interface BatchInfo {
  id: string;
  label: string;
  description: string;
  memberCount: number;
  compliance: number;
  passRate: number;
  failRate: number;
  activeSessions: number;
}

export const BATCHES: BatchInfo[] = [
  {
    id: "batch_a",
    label: "Batch A — Engineering",
    description: "Product & platform engineering teams",
    memberCount: 2,
    compliance: 78,
    passRate: 88,
    failRate: 12,
    activeSessions: 4,
  },
  {
    id: "batch_b",
    label: "Batch B — Operations",
    description: "Field operations & logistics",
    memberCount: 1,
    compliance: 51,
    passRate: 71,
    failRate: 29,
    activeSessions: 3,
  },
];

export const ADMIN_METRICS = {
  totalCompliance: 64,
  activeSessions: 7,
  passRate: 82,
  failRate: 18,
  batchBreakdown: BATCHES.map((b) => ({
    batchId: b.id,
    label: b.label,
    compliance: b.compliance,
    pass: b.passRate,
    fail: b.failRate,
  })),
};

export function getBatchById(batchId: string): BatchInfo | undefined {
  return BATCHES.find((b) => b.id === batchId);
}

export function getProgressForBatch(batchId: string) {
  return EMPLOYEE_PROGRESS.filter((p) => p.batchId === batchId);
}

export function getAiReportForBatch(batchId: string): string {
  if (batchId === "batch_a") {
    return `## Batch A — Engineering

**Overall compliance: 78%** — above org baseline. **Phishing Basics** has low uptake: 2 learners have not started.

**MCQ performance:** Strong on GDPR (100% first-attempt pass). Security module checkpoints averaging **1.2 attempts**.

**Q&A themes:** MFA on personal devices (2), VPN split-tunnel policy (1).

**Recommended:** Send reminder for Phishing Basics; no live intervention required.`;
  }
  return `## Batch B — Operations

**Overall compliance: 51%** — below baseline. **Q3 Security** checkpoint at Slide 6 averaging **2.4 MCQ attempts**.

**Active sessions:** 3 learners mid-module — candidate for live slide sync.

**Q&A themes:** Incident escalation paths (2), vendor risk workflow (1).

**Recommended:** Use Live Control to push supplemental MCQ on incident SLAs; schedule slide sync at Slide 6.`;
}

export function getModulesForBatch(batchId: string): TrainingModule[] {
  return TRAINING_MODULES.filter((m) => m.batchIds.includes(batchId));
}

export function getMcqForSlide(moduleId: string, slideIndex: number): McqQuestion | undefined {
  return MOCK_MCQS[moduleId]?.find((q) => q.slideIndex === slideIndex);
}
