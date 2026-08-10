"use client";

import { useRef, useState, useTransition } from "react";
import {
  clearMarksByTokenAction,
  uploadGradesCsvByTokenAction,
} from "./actions";

export function MarkerUploadPanel({
  examId,
  token,
}: {
  examId: number;
  token: string;
}) {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const r = await uploadGradesCsvByTokenAction(examId, token, fd);
        const parts: string[] = [`Saved ${r.saved} row${r.saved === 1 ? "" : "s"}`];
        if (r.ignoredAbsent > 0) {
          parts.push(
            `ignored ${r.ignoredAbsent} absent student${r.ignoredAbsent === 1 ? "" : "s"}`,
          );
        }
        if (r.skipped.length > 0) {
          parts.push(`skipped ${r.skipped.length} row${r.skipped.length === 1 ? "" : "s"}`);
        }
        setSummary(parts.join(", ") + ".");
        if (fileRef.current) fileRef.current.value = "";
        if (r.skipped.length > 0) {
          setError(r.skipped.slice(0, 20).join("\n"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onClear() {
    if (
      !window.confirm(
        "Are you sure? This deletes every grade and comment you have entered so far for this exam.",
      )
    ) {
      return;
    }
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        await clearMarksByTokenAction(examId, token);
        setSummary("All grades cleared.");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Bulk actions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload a CSV with columns <code>Seat number</code>,{" "}
        <code>Grade</code>, <code>Comments</code>. Rows for students marked
        absent by the admin are ignored; the rest are saved.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a
          href={`/api/exams/${examId}/grades-template.csv`}
          className="text-xs text-blue-600 hover:underline"
        >
          Download blank template CSV
        </a>
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all my grades
        </button>
      </div>
      <form
        onSubmit={onUpload}
        className="mt-3 flex flex-wrap items-center gap-3"
      >
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload grades CSV"}
        </button>
      </form>
      {summary && (
        <p className="mt-3 text-sm text-green-700">{summary}</p>
      )}
      {error && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-800">
          {error}
        </pre>
      )}
    </section>
  );
}
