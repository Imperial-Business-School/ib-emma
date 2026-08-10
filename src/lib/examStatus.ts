// Status constants split out from db.ts so client components can import
// them without dragging in pg (which is Node-only).

export type ExamStatus =
  | "setup"
  | "primary_marking"
  | "first_marking_overdue"
  | "first_marking_late"
  | "first_marking_review"
  | "secondary_marking"
  | "second_marking_overdue"
  | "second_marking_late"
  | "review"
  | "complete";

export type SamplingMode = "standard" | "full";

export type ProgrammeLevel = "MSc" | "MBA" | "MRes" | "PhD" | "BSc";
export const PROGRAMME_LEVELS: ProgrammeLevel[] = [
  "MSc",
  "MBA",
  "MRes",
  "PhD",
  "BSc",
];

export type Programme = {
  id: number;
  name: string;
  programme_id: string;
  level: ProgrammeLevel;
  created_at: string;
};

export type Admin = {
  id: number;
  email: string;
  name: string;
  created_at: string;
  last_access_at: string | null;
};

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  setup: "Setup",
  primary_marking: "Primary marking in progress",
  first_marking_overdue: "First marking overdue",
  first_marking_late: "First marking late",
  first_marking_review: "First marking complete — ready for admin review",
  secondary_marking: "Secondary marking in progress",
  second_marking_overdue: "Second marking overdue",
  second_marking_late: "Second marking late",
  review: "Requires Review",
  complete: "Ready for Canvas upload",
};

export function isPrimaryMarkingPhase(status: ExamStatus): boolean {
  return (
    status === "primary_marking" ||
    status === "first_marking_overdue" ||
    status === "first_marking_late"
  );
}

export function isSecondaryMarkingPhase(status: ExamStatus): boolean {
  return (
    status === "secondary_marking" ||
    status === "second_marking_overdue" ||
    status === "second_marking_late"
  );
}

export const STATUS_BADGE_CLASS: Record<ExamStatus, string> = {
  setup: "bg-slate-100 text-slate-700",
  primary_marking: "bg-blue-100 text-blue-800",
  first_marking_overdue: "bg-amber-200 text-amber-900",
  first_marking_late: "bg-red-200 text-red-900",
  first_marking_review: "bg-purple-100 text-purple-800",
  secondary_marking: "bg-indigo-100 text-indigo-800",
  second_marking_overdue: "bg-amber-200 text-amber-900",
  second_marking_late: "bg-red-200 text-red-900",
  review: "bg-amber-100 text-amber-800",
  complete: "bg-green-100 text-green-800",
};
