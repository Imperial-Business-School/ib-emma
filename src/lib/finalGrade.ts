export const DISCREPANCY_THRESHOLD = 5;

export type FinalGradeResult = {
  value: string | null;
  needsAdmin: boolean;
};

// Determines the final grade for a submission given the two marker grades and
// whether it was in the second-marking sample.
//
// - Non-sampled seats: final = primary grade (only one marker saw it).
// - Sampled, both numeric, |primary - secondary| <= 5: final = average.
// - Sampled, anything else (large discrepancy, non-numeric, missing grade):
//   final is left null; admin must intervene.
export function computeFinalGrade(
  primary: string | null,
  secondary: string | null,
  inSample: boolean,
): FinalGradeResult {
  if (!inSample) {
    return { value: primary, needsAdmin: false };
  }
  const p = primary == null ? NaN : Number(primary);
  const s = secondary == null ? NaN : Number(secondary);
  if (!Number.isFinite(p) || !Number.isFinite(s)) {
    return { value: null, needsAdmin: true };
  }
  if (Math.abs(p - s) <= DISCREPANCY_THRESHOLD) {
    const avg = (p + s) / 2;
    return { value: formatGrade(avg), needsAdmin: false };
  }
  return { value: null, needsAdmin: true };
}

function formatGrade(n: number): string {
  // Trim trailing zeros: 52.5 -> "52.5", 50 -> "50", 50.15 -> "50.15".
  return n.toFixed(2).replace(/\.?0+$/, "");
}
