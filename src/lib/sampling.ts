// Grade-boundary ranges that automatically qualify a paper for second marking.
// Any numeric grade falling in any of these inclusive ranges is sampled.
const BOUNDARY_RANGES: ReadonlyArray<readonly [number, number]> = [
  [39, 41],
  [49, 51],
  [59, 61],
  [69, 71],
  [79, 81],
];

export function isBoundaryGrade(grade: string | null): boolean {
  if (grade == null) return false;
  const g = Number(grade);
  if (!Number.isFinite(g)) return false;
  return BOUNDARY_RANGES.some(([lo, hi]) => g >= lo && g <= hi);
}

export type SamplingInput = { id: number; grade: string | null };

export function computeSampleIds(
  submissions: ReadonlyArray<SamplingInput>,
  rng: () => number = Math.random,
): number[] {
  const total = submissions.length;
  if (total === 0) return [];

  const boundary: number[] = [];
  const others: number[] = [];
  for (const s of submissions) {
    if (isBoundaryGrade(s.grade)) boundary.push(s.id);
    else others.push(s.id);
  }

  // At least 10% of papers, or 10 minimum -- capped at total.
  const minSample = Math.min(total, Math.max(10, Math.ceil(total * 0.1)));
  const needed = Math.max(0, minSample - boundary.length);

  // Fisher-Yates shuffle of the non-boundary papers.
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  return [...boundary, ...others.slice(0, needed)];
}
