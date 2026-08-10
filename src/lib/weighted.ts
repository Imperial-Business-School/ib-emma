// Weighted grade calculation.
//
// finalGrade  -- string returned by markers (or admin override)
// mcqScore    -- string entered by admin per student (if MCQ enabled)
// mcqWeight   -- percentage (0-100) as a number/string, or null when MCQ
//                is not enabled on the exam
//
// If MCQ isn't enabled OR either input is missing/non-numeric, the
// weighted grade is just the final grade unchanged. Otherwise:
//
//   weighted = final * (1 - w/100) + mcq * (w/100)
//
// Result is trimmed to remove trailing zeros ("52.5", "50").
export function computeWeightedGrade(
  finalGrade: string | null,
  mcqScore: string | null,
  mcqWeight: string | number | null,
  mcqEnabled: boolean,
): string | null {
  if (finalGrade == null) return null;
  if (!mcqEnabled) return finalGrade;

  const f = Number(finalGrade);
  const m = mcqScore == null ? NaN : Number(mcqScore);
  const w =
    mcqWeight == null
      ? NaN
      : typeof mcqWeight === "number"
        ? mcqWeight
        : Number(mcqWeight);
  if (!Number.isFinite(f)) return finalGrade;
  if (!Number.isFinite(m) || !Number.isFinite(w)) return finalGrade;

  const weighted = f * (1 - w / 100) + m * (w / 100);
  return format(weighted);
}

function format(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}
