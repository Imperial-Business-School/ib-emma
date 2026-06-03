export type FinalGradeResult = {
  value: string | null;
  needsResolution: boolean;
};

// Final grade rule (current spec):
// - Non-sampled seats: final = primary grade.
// - Sampled seats with exactly matching primary and secondary grades:
//   final = that grade.
// - Sampled seats with any mismatch (including non-numeric values):
//   final is null, marked for primary marker to resolve.
export function computeFinalGrade(
  primary: string | null,
  secondary: string | null,
  inSample: boolean,
): FinalGradeResult {
  if (!inSample) {
    return { value: primary, needsResolution: false };
  }
  if (primary != null && secondary != null && primary === secondary) {
    return { value: primary, needsResolution: false };
  }
  return { value: null, needsResolution: true };
}
