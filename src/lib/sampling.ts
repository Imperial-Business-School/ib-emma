// Grade-boundary sampling rules (post-primary-marking).
//
// For BSc programmes the fail threshold is < 40; for MSc / MBA it's < 50.
// The second-marking sample is built as follows:
//   1. Every failed student is included.
//   2. The student awarded the highest grade is included.
//   3. The student awarded the lowest NON-FAIL grade is included.
//   4. At least one student from each grade bracket (40-49, 50-59, 60-69,
//      70-79, 80-89, 90-100) that contains any non-fail students.
//   5. Random additional non-fail students until the non-fail sample is
//      at least max(10, ceil(0.1 * cohort)).
//
// If the cohort is too small to satisfy every rule, the sample simply
// contains everyone.

const GRADE_BRACKETS: ReadonlyArray<readonly [number, number]> = [
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 89],
  [90, 100],
];

export type SamplingInput = { id: number; grade: string | null };

export type SamplingProgrammeLevel = "MSc" | "MBA" | "BSc";

export function failThresholdFor(
  level: SamplingProgrammeLevel | null | undefined,
): number {
  return level === "BSc" ? 40 : 50;
}

function parseGrade(grade: string | null): number | null {
  if (grade == null) return null;
  const n = Number(grade);
  return Number.isFinite(n) ? n : null;
}

export function computeSampleIdsForMode(
  submissions: ReadonlyArray<SamplingInput>,
  mode: "standard" | "full",
  programmeLevel: SamplingProgrammeLevel | null = null,
  rng: () => number = Math.random,
): number[] {
  if (mode === "full") return submissions.map((s) => s.id);
  return computeStandardSample(submissions, programmeLevel, rng);
}

// New standard-sampling algorithm. See the module comment above for the
// full rule set.
export function computeStandardSample(
  submissions: ReadonlyArray<SamplingInput>,
  programmeLevel: SamplingProgrammeLevel | null = null,
  rng: () => number = Math.random,
): number[] {
  const total = submissions.length;
  if (total === 0) return [];

  const failThreshold = failThresholdFor(programmeLevel);
  const targetNonFailCount = Math.max(10, Math.ceil(total * 0.1));

  const enriched = submissions.map((s) => ({
    id: s.id,
    grade: parseGrade(s.grade),
  }));

  const included = new Set<number>();

  // 1. all fails (numeric grade below threshold OR non-numeric grades,
  // which we treat as ineligible-so-sample-me).
  for (const s of enriched) {
    if (s.grade == null || s.grade < failThreshold) included.add(s.id);
  }

  // Split remaining into non-fail pool.
  const nonFails = enriched.filter(
    (s) => s.grade != null && s.grade >= failThreshold,
  );

  if (nonFails.length === 0) {
    return [...included];
  }

  // 2. Highest scorer.
  const highest = nonFails.reduce((a, b) =>
    (a.grade ?? -Infinity) >= (b.grade ?? -Infinity) ? a : b,
  );
  included.add(highest.id);

  // 3. Lowest NON-FAIL scorer.
  const lowest = nonFails.reduce((a, b) =>
    (a.grade ?? Infinity) <= (b.grade ?? Infinity) ? a : b,
  );
  included.add(lowest.id);

  // 4. One from each populated grade bracket.
  for (const [lo, hi] of GRADE_BRACKETS) {
    const alreadyCovered = nonFails.some(
      (s) =>
        included.has(s.id) &&
        s.grade != null &&
        s.grade >= lo &&
        s.grade <= hi,
    );
    if (alreadyCovered) continue;
    const candidates = nonFails.filter(
      (s) => s.grade != null && s.grade >= lo && s.grade <= hi,
    );
    if (candidates.length === 0) continue;
    // Deterministic-ish pick: shuffle candidates and take one.
    const pick = candidates[Math.floor(rng() * candidates.length)];
    included.add(pick.id);
  }

  // 5. Random fill on non-fails to hit the target size.
  const nonFailSampleCount = nonFails.filter((s) => included.has(s.id))
    .length;
  const needed = Math.max(0, targetNonFailCount - nonFailSampleCount);
  if (needed > 0) {
    const remaining = nonFails.filter((s) => !included.has(s.id));
    // Fisher-Yates shuffle
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    for (const s of remaining.slice(0, needed)) included.add(s.id);
  }

  return [...included];
}

// Kept for backwards compatibility with any existing callers.
export const computeSampleIds = computeStandardSample;

export function isBoundaryGrade(_grade: string | null): boolean {
  // Deprecated helper: the new sample logic no longer distinguishes by
  // boundary bands, so this always returns false. Left in place so any
  // stale imports don't crash.
  return false;
}
