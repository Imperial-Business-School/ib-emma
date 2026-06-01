"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveGradesByTokenAction } from "./actions";

export type GradeRow = {
  id: number;
  seat_number: string;
  current_grade: string | null;
  saved_at: string | null;
  primary_grade?: string | null;
};

type SaveResult = { id: number; saved_at: string | null };

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function GradeTable({
  examId,
  token,
  rows,
  isSecondary,
  markingOpen,
}: {
  examId: number;
  token: string;
  rows: GradeRow[];
  isSecondary: boolean;
  markingOpen: boolean;
}) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.current_grade ?? ""])),
  );
  const [savedAt, setSavedAt] = useState<Record<number, string | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.saved_at])),
  );
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // When the parent server component re-renders with new rows (e.g. after the
  // Quick Entry form above writes to the DB), sync the table's local state.
  // We only update a row's input if the user hasn't typed something different
  // from the last server value -- preserving any in-progress edits.
  const lastServerRowsRef = useRef<GradeRow[]>(rows);
  useEffect(() => {
    const prev = new Map(lastServerRowsRef.current.map((r) => [r.id, r]));
    setValues((current) => {
      const next = { ...current };
      for (const r of rows) {
        const previousServer = prev.get(r.id)?.current_grade ?? "";
        const newServer = r.current_grade ?? "";
        // Add brand-new rows, and refresh rows the user hasn't touched.
        if (!(r.id in current) || current[r.id] === previousServer) {
          next[r.id] = newServer;
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
    setPendingIds((prev) => new Set([...prev, ...ids]));
    const updates = ids.map((id) => ({ id, grade: values[id] ?? "" }));
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
    const dirty = rows
      .filter((r) => values[r.id] !== (r.current_grade ?? ""))
      .map((r) => r.id);
    if (dirty.length === 0) {
      // Save everything visible anyway, useful for "lock everything in".
      persist(rows.map((r) => r.id));
    } else {
      persist(dirty);
    }
  }

  const dirtyCount = rows.filter(
    (r) => values[r.id] !== (r.current_grade ?? ""),
  ).length;

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">
            {isSecondary ? "Sampled seats" : "All seats"}
          </h2>
          <p className="text-xs text-slate-500">CIDs are hidden from markers.</p>
        </div>
        {markingOpen && (
          <button
            type="button"
            onClick={saveAll}
            disabled={pendingIds.size > 0}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {dirtyCount > 0 ? `Save all (${dirtyCount} unsaved)` : "Save all"}
          </button>
        )}
      </div>
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2 w-24">Seat</th>
            {isSecondary && <th className="px-4 py-2 w-32">Primary grade</th>}
            <th className="px-4 py-2">
              {isSecondary ? "Your grade" : "Grade"}
            </th>
            <th className="px-4 py-2">Saved</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={isSecondary ? 4 : 3}
                className="px-4 py-8 text-center text-slate-500"
              >
                {isSecondary
                  ? "No sample available yet."
                  : "No seats uploaded for this exam yet."}
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const value = values[r.id] ?? "";
            const dirty = value !== (r.current_grade ?? "");
            const saving = pendingIds.has(r.id);
            return (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono">{r.seat_number}</td>
                {isSecondary && (
                  <td className="px-4 py-2 font-mono text-slate-700">
                    {r.primary_grade ?? "—"}
                  </td>
                )}
                <td className="px-4 py-2">
                  {markingOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={value}
                        onChange={(e) =>
                          setValues((p) => ({ ...p, [r.id]: e.target.value }))
                        }
                        placeholder="—"
                        className={`w-32 rounded border px-2 py-1 text-sm ${dirty ? "border-blue-400 bg-blue-50" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => saveOne(r.id)}
                        disabled={saving}
                        className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <span className="font-mono">{value || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {savedAt[r.id]
                    ? `Grade saved at ${fmtTime(savedAt[r.id]!)}`
                    : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
