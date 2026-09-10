"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GRADE_REGEX_SOURCE, isValidGrade } from "@/lib/validation";
import { formatDateTime } from "@/lib/datetime";
import { computeWeightedGrade } from "@/lib/weighted";
import { saveGradesByTokenAction } from "./actions";

export type GradeRow = {
  id: number;
  seat_number: string;
  current_grade: string | null;
  saved_at: string | null;
  current_comment: string | null;
  absent?: boolean;
  mcq_score?: string | null;
  // For secondary marker: the primary marker's grade.
  primary_grade?: string | null;
  // For primary marker in resolution view:
  primary_comment?: string | null;
  secondary_grade?: string | null;
  secondary_comment?: string | null;
};

type SortKey =
  | "seat"
  | "grade"
  | "primary_grade"
  | "mcq"
  | "saved";
type SortDir = "asc" | "desc";

const naturalSeatCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
function naturalCompareSeat(a: string, b: string): number {
  return naturalSeatCollator.compare(a, b);
}
function numericCompare(a: string | null | undefined, b: string | null | undefined): number {
  const aN = a == null ? NaN : Number(a);
  const bN = b == null ? NaN : Number(b);
  const aBad = !Number.isFinite(aN);
  const bBad = !Number.isFinite(bN);
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  return aN - bN;
}

type SaveResult = { id: number; saved_at: string | null };

function fmtTime(iso: string | null): string {
  return formatDateTime(iso);
}

export function GradeTable({
  examId,
  token,
  rows,
  isSecondary,
  isResolving,
  markingOpen,
  mcqEnabled = false,
  mcqWeighting = null,
  graded,
  total,
}: {
  examId: number;
  token: string;
  rows: GradeRow[];
  isSecondary: boolean;
  isResolving: boolean;
  markingOpen: boolean;
  graded: number;
  total: number;
  mcqEnabled?: boolean;
  mcqWeighting?: string | null;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "seat",
    dir: "asc",
  });
  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }
  const sortedRows = [...rows].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.key) {
      case "seat":
        return dir * naturalCompareSeat(a.seat_number, b.seat_number);
      case "grade":
        return dir * numericCompare(a.current_grade, b.current_grade);
      case "primary_grade":
        return dir * numericCompare(a.primary_grade, b.primary_grade);
      case "mcq":
        return dir * numericCompare(a.mcq_score, b.mcq_score);
      case "saved":
        return dir * (a.saved_at ?? "").localeCompare(b.saved_at ?? "");
    }
  });
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.current_grade ?? ""])),
  );
  const [comments, setComments] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.current_comment ?? ""])),
  );
  const [savedAt, setSavedAt] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.saved_at])),
  );
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const lastServerRowsRef = useRef<GradeRow[]>(rows);
  useEffect(() => {
    const prev = new Map(lastServerRowsRef.current.map((r) => [r.id, r]));
    setValues((current) => {
      const next = { ...current };
      for (const r of rows) {
        const prevServer = prev.get(r.id)?.current_grade ?? "";
        if (!(r.id in current) || current[r.id] === prevServer) {
          next[r.id] = r.current_grade ?? "";
        }
      }
      return next;
    });
    setComments((current) => {
      const next = { ...current };
      for (const r of rows) {
        const prevServer = prev.get(r.id)?.current_comment ?? "";
        if (!(r.id in current) || current[r.id] === prevServer) {
          next[r.id] = r.current_comment ?? "";
        }
      }
      return next;
    });
    setSavedAt((current) => {
      const next = { ...current };
      for (const r of rows) next[r.id] = r.saved_at;
      return next;
    });
    lastServerRowsRef.current = rows;
  }, [rows]);

  function persist(ids: number[]): void {
    if (ids.length === 0) return;
    setError(null);
    // Client-side validation: refuse to send anything malformed.
    for (const id of ids) {
      const v = (values[id] ?? "").trim();
      if (!isValidGrade(v)) {
        setError(
          `Grade "${v}" must be a number between 0 and 100 with up to two decimal places`,
        );
        return;
      }
    }
    // Second marker: refuse to save when any dirty row has a grade
    // that differs from the first marker's but no comment. Server
    // rejects this too, but its error propagates back through the
    // Server Actions runtime as the generic "an error occurred in the
    // Server Components render" digest string in production, which
    // reveals nothing to the marker about what to fix.
    if (isSecondary && !isResolving) {
      const rowById = new Map(rows.map((r) => [r.id, r]));
      const missing: string[] = [];
      for (const id of ids) {
        const r = rowById.get(id);
        if (!r || r.absent) continue;
        const v = (values[id] ?? "").trim();
        const c = (comments[id] ?? "").trim();
        if (
          v !== "" &&
          r.primary_grade != null &&
          v !== r.primary_grade &&
          c === ""
        ) {
          missing.push(r.seat_number);
        }
      }
      if (missing.length > 0) {
        const plural = missing.length === 1 ? "" : "s";
        setError(
          `Add a comment for seat${plural} ${missing.join(", ")} before saving — a comment is required when your grade differs from the first marker's.`,
        );
        return;
      }
    }
    // First marker resolving discrepancies: every row must carry a
    // comment explaining why the final grade lands where it does.
    if (isResolving) {
      const rowById = new Map(rows.map((r) => [r.id, r]));
      const missing: string[] = [];
      for (const id of ids) {
        const r = rowById.get(id);
        if (!r || r.absent) continue;
        const v = (values[id] ?? "").trim();
        const c = (comments[id] ?? "").trim();
        if (v !== "" && c === "") missing.push(r.seat_number);
      }
      if (missing.length > 0) {
        const plural = missing.length === 1 ? "" : "s";
        setError(
          `Add a comment for seat${plural} ${missing.join(", ")} before saving — a comment is required to explain the final grade.`,
        );
        return;
      }
    }
    setPendingIds((prev) => new Set([...prev, ...ids]));
    const updates = ids.map((id) => ({
      id,
      grade: values[id] ?? "",
      comment: comments[id] ?? "",
    }));
    startTransition(async () => {
      try {
        const results: SaveResult[] = await saveGradesByTokenAction(
          examId,
          token,
          updates,
        );
        setSavedAt((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.id] = r.saved_at;
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
      }
    });
  }

  function saveOne(id: number) {
    persist([id]);
  }

  function saveAll() {
    const gradable = rows.filter((r) => !r.absent);
    const dirty = gradable
      .filter(
        (r) =>
          values[r.id] !== (r.current_grade ?? "") ||
          comments[r.id] !== (r.current_comment ?? ""),
      )
      .map((r) => r.id);
    if (dirty.length === 0) {
      persist(gradable.map((r) => r.id));
    } else {
      persist(dirty);
    }
  }

  const dirtyCount = rows.filter(
    (r) =>
      !r.absent &&
      (values[r.id] !== (r.current_grade ?? "") ||
        comments[r.id] !== (r.current_comment ?? "")),
  ).length;

  const showPrimary = isSecondary || isResolving;
  const showSecondary = isResolving;
  // Views that show a primary_grade column put MCQ right after Seat
  // (so the reader can weigh the MCQ before looking at the other
  // marker's grade). Primary-marker default view has no primary_grade
  // column, so MCQ sits next to the marker's own grade instead.
  const mcqBeforePrimary = mcqEnabled && (isSecondary || isResolving);
  const mcqAfterPrimary = mcqEnabled && !mcqBeforePrimary;
  const yourLabel = isResolving
    ? "Final grade"
    : isSecondary
      ? "Your grade"
      : "Grade";
  // First marker leaves "Feedback" during their normal marking pass;
  // second marker leaves "Comments" on their sampled seats. In the
  // resolution view (still the first marker) the note explains why
  // the final grade lands where it does, so we call it "Comments"
  // and require one for every row.
  const yourCommentLabel =
    isResolving || isSecondary ? "Comments" : "Feedback";

  // Running mean / std of this marker's saved grades. Weighted
  // by MCQ when MCQ is enabled on the exam, so the marker sees the
  // grade that would actually be recorded, not their raw script grade.
  // Shown on both the first- and second-marker marking views; hidden
  // during the resolution phase where "the marker's grade" is the
  // final grade being resolved and stats over a discrepancy-only view
  // would be misleading.
  const showMarkerStats = !isResolving;
  // For the second marker, each row already has the first marker's
  // grade set. Fall back to it so the Weighted grade column and the
  // stats footer stay populated for every row before the second
  // marker has touched it, and recalculate as they save their own.
  // For the first marker, r.primary_grade is undefined, so this just
  // reduces to r.current_grade.
  const effectiveGrade = (r: GradeRow) =>
    r.current_grade ?? r.primary_grade ?? null;
  const savedWeighted = showMarkerStats
    ? rows
        .filter((r) => !r.absent && effectiveGrade(r) != null)
        .map((r) =>
          computeWeightedGrade(
            effectiveGrade(r),
            r.mcq_score ?? null,
            mcqWeighting,
            mcqEnabled,
          ),
        )
        .map((v) => (v == null ? NaN : Number(v)))
        .filter((n) => Number.isFinite(n))
    : [];
  const statN = savedWeighted.length;
  const statMean =
    statN > 0
      ? savedWeighted.reduce((a, b) => a + b, 0) / statN
      : null;
  // Population standard deviation (divide by N, not N-1) -- treats
  // the saved grades as the whole population, not a sample from a
  // larger one. Undefined when the marker has fewer than 2 saved
  // grades, in which case we render "N/A".
  const statStd =
    statN >= 2 && statMean != null
      ? Math.sqrt(
          savedWeighted.reduce(
            (a, b) => a + (b - statMean) * (b - statMean),
            0,
          ) / statN,
        )
      : null;
  const fmtMean = (n: number | null) =>
    n == null ? "N/A" : n.toFixed(2);
  const fmtStd = (n: number | null) =>
    n == null ? "N/A" : n.toFixed(2);

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">
            {isResolving
              ? "Discrepancies"
              : isSecondary
                ? "Sampled seats"
                : "All seats"}
          </h2>
          <p
            className={`mt-1 text-xl font-semibold ${
              total > 0 && graded === total
                ? "text-green-700"
                : "text-slate-800"
            }`}
          >
            {graded} of {total}{" "}
            {isResolving
              ? "resolved"
              : isSecondary
                ? "sampled seats graded"
                : "seats graded"}
            {total > 0 && graded === total ? " ✓" : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isSecondary ? (
              <>
                Comments are optional where the second marker agrees with
                the first marker&apos;s grade. If you wish to give a
                different grade to the first marker, you must provide a
                reason in the comment box.
              </>
            ) : (
              <>CIDs are hidden from markers. Feedback is optional.</>
            )}
          </p>
        </div>
      </div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">
        <thead className="border-b bg-slate-50 text-left text-slate-600">
          <tr>
            <SortableTh
              label="Seat"
              active={sort.key === "seat"}
              dir={sort.dir}
              onClick={() => onSort("seat")}
              className="w-20"
            />
            {mcqBeforePrimary && (
              <SortableTh
                label="MCQ score"
                active={sort.key === "mcq"}
                dir={sort.dir}
                onClick={() => onSort("mcq")}
              />
            )}
            {showPrimary && (
              <SortableTh
                label="First grade"
                active={sort.key === "primary_grade"}
                dir={sort.dir}
                onClick={() => onSort("primary_grade")}
              />
            )}
            {(isResolving || isSecondary) && (
              <th className="px-4 py-2">Feedback</th>
            )}
            {showSecondary && <th className="px-4 py-2">Secondary grade</th>}
            {isResolving && <th className="px-4 py-2">Comments</th>}
            {mcqAfterPrimary && (
              <SortableTh
                label="MCQ score"
                active={sort.key === "mcq"}
                dir={sort.dir}
                onClick={() => onSort("mcq")}
              />
            )}
            <SortableTh
              label={yourLabel}
              active={sort.key === "grade"}
              dir={sort.dir}
              onClick={() => onSort("grade")}
            />
            <th className="px-4 py-2">{yourCommentLabel}</th>
            {showMarkerStats && mcqEnabled && (
              <th className="px-4 py-2">Weighted grade</th>
            )}
            <SortableTh
              label="Saved"
              active={sort.key === "saved"}
              dir={sort.dir}
              onClick={() => onSort("saved")}
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 && (
            <tr>
              <td
                colSpan={
                  3 +
                  (showPrimary ? 1 : 0) +
                  (showSecondary ? 1 : 0) +
                  (isResolving || isSecondary ? 1 : 0) +
                  (isResolving ? 1 : 0) +
                  (mcqEnabled ? 1 : 0) +
                  (showMarkerStats && mcqEnabled ? 1 : 0)
                }
                className="px-4 py-8 text-center text-slate-500"
              >
                {isResolving
                  ? "No discrepancies to resolve."
                  : isSecondary
                    ? "No sample available yet."
                    : "No seats uploaded for this exam yet."}
              </td>
            </tr>
          )}
          {sortedRows.map((r) => {
            const value = values[r.id] ?? "";
            const comment = comments[r.id] ?? "";
            const dirty =
              value !== (r.current_grade ?? "") ||
              comment !== (r.current_comment ?? "");
            const saving = pendingIds.has(r.id);
            // Second marker must comment whenever their grade differs
            // from the primary's; primary marker resolving a
            // discrepancy must comment on every row explaining the
            // final grade. Drives the red outline + placeholder on
            // the comment input while they're still typing.
            const commentRequired =
              (isSecondary &&
                !isResolving &&
                value.trim() !== "" &&
                r.primary_grade != null &&
                value !== r.primary_grade) ||
              (isResolving && value.trim() !== "");
            const commentMissing = commentRequired && comment.trim() === "";
            return (
              <tr key={r.id} className="border-b last:border-b-0 align-top">
                <td className="px-4 py-2 font-mono">{r.seat_number}</td>
                {mcqBeforePrimary && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.absent ? "—" : (r.mcq_score ?? "—")}
                  </td>
                )}
                {showPrimary && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.primary_grade ?? "—"}
                  </td>
                )}
                {(isResolving || isSecondary) && (
                  <td className="px-4 py-2 text-slate-700">
                    {r.primary_comment ?? "—"}
                  </td>
                )}
                {showSecondary && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.secondary_grade ?? "—"}
                  </td>
                )}
                {isResolving && (
                  <td className="px-4 py-2 text-slate-700">
                    {r.secondary_comment ?? "—"}
                  </td>
                )}
                {mcqAfterPrimary && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.absent ? "—" : (r.mcq_score ?? "—")}
                  </td>
                )}
                <td className="px-4 py-2">
                  {r.absent ? (
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
                      Absent
                    </span>
                  ) : markingOpen ? (
                    <input
                      value={value}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, [r.id]: e.target.value }))
                      }
                      placeholder="—"
                      pattern={GRADE_REGEX_SOURCE}
                      inputMode="decimal"
                      title="Number between 0 and 100 with up to two decimal places"
                      className={`w-24 rounded border px-2 py-1 text-sm ${dirty ? "border-blue-400 bg-blue-50" : ""}`}
                    />
                  ) : (
                    <span className="font-mono">{value || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.absent ? (
                    <span className="text-slate-400">n/a</span>
                  ) : markingOpen ? (
                    <textarea
                      value={comment}
                      onChange={(e) =>
                        setComments((p) => ({ ...p, [r.id]: e.target.value }))
                      }
                      placeholder={commentRequired ? "required" : "optional"}
                      title={
                        commentRequired
                          ? isResolving
                            ? "A comment is required to explain the final grade."
                            : "Your grade differs from the first marker's — a comment is required."
                          : undefined
                      }
                      maxLength={250}
                      rows={2}
                      className={`block w-full min-w-[16rem] resize-y rounded border px-2 py-1 text-sm leading-snug ${
                        commentMissing
                          ? "border-red-400 bg-red-50"
                          : dirty
                            ? "border-blue-400 bg-blue-50"
                            : ""
                      }`}
                    />
                  ) : (
                    <span className="block whitespace-pre-wrap break-words text-slate-700">
                      {comment || "—"}
                    </span>
                  )}
                </td>
                {showMarkerStats && mcqEnabled && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.absent
                      ? "—"
                      : (computeWeightedGrade(
                          effectiveGrade(r),
                          r.mcq_score ?? null,
                          mcqWeighting,
                          mcqEnabled,
                        ) ?? (
                          <span className="text-slate-400">—</span>
                        ))}
                  </td>
                )}
                <td className="px-4 py-2 text-xs text-slate-600">
                  {r.absent
                    ? ""
                    : savedAt[r.id]
                      ? `Saved at ${fmtTime(savedAt[r.id]!)}`
                      : ""}
                  {markingOpen && !r.absent && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => saveOne(r.id)}
                        disabled={saving}
                        className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {saving ? "Submitting…" : "Save"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {markingOpen && (
        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={saveAll}
            disabled={pendingIds.size > 0}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {pendingIds.size > 0
              ? "Submitting…"
              : dirtyCount > 0
                ? `Save all (${dirtyCount} unsaved)`
                : "Save all"}
          </button>
        </div>
      )}
      {showMarkerStats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span>
            <span className="text-slate-500">Mean</span>
            {mcqEnabled ? (
              <span className="text-slate-500"> (weighted)</span>
            ) : null}
            :{" "}
            <span className="font-semibold text-slate-900">
              {fmtMean(statMean)}
            </span>
          </span>
          <span>
            <span className="text-slate-500">Std dev</span>
            {mcqEnabled ? (
              <span className="text-slate-500"> (weighted)</span>
            ) : null}
            :{" "}
            <span className="font-semibold text-slate-900">
              {fmtStd(statStd)}
            </span>
          </span>
          <span className="text-slate-500">
            over {statN} saved grade{statN === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </section>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className="hover:text-slate-900"
      >
        {label}
        <span className="ml-1 text-slate-400">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
