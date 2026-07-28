/**
 * COA (Certificate of Acceptance) Document Progress Tracker Types
 * SMEI TSD Portal Compliance Engine
 */

export type COAWorkflowStepKey =
  | "control-no"
  | "unloading-loading"
  | "hazardous-waste"
  | "waste-movement"
  | "timestamp";

export type COAStepStatus = "completed" | "in_progress" | "pending" | "locked";

export interface COAWorkflowStep {
  key: COAWorkflowStepKey;
  stepNumber: number; // 1 to 5
  title: string;
  subtitle: string;
  status: COAStepStatus;
  isCompleted: boolean;
  isCurrent: boolean;
  documentNumber?: string;
  timestamp?: string;
  formattedDate?: string;
  createdBy?: string;
  updatedAt?: string;
  details?: Record<string, any>;
  isLocked?: boolean;
}

export interface COAWorkflowProgress {
  selectedControlNo: string;
  availableControlNumbers: string[];
  completedCount: number;
  totalCount: number; // Always 5
  percentage: number;
  isReadyForCOA: boolean;
  steps: COAWorkflowStep[];
  lastUpdated: string;
}
