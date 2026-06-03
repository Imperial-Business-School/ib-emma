// Status constants split out from db.ts so client components can import
// them without dragging in pg (which is Node-only).

export type ExamStatus =
  | "setup"
  | "primary_marking"
  | "first_marking_review"
  | "secondary_marking"
  | "review"
  | "complete";

export type SamplingMode = "standard" | "full";

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  setup: "Setup",
  primary_marking: "Primary marking in progress",
  first_marking_review: "First marking complete — ready for admin review",
  secondary_marking: "Secondary marking in progress",
  review: "Requires Review",
  complete: "Ready for Canvas upload",
};
