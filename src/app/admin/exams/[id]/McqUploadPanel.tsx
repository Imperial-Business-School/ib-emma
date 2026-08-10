"use client";

import { useRef, useState, useTransition } from "react";
import { uploadMcqCsvAction } from "../../actions";

export function McqUploadPanel({ examId }: { examId: number }) {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const r = await uploadMcqCsvAction(examId, fd);
        setSummary(
          `Saved ${r.saved} row${r.saved === 1 ? "" : "s"}${
            r.skipped.length ? `, skipped ${r.skipped.length}` : ""
          }.`,
        );
        if (fileRef.current) fileRef.current.value = "";
        if (r.skipped.length) setError(r.skipped.slice(0, 20).join("\n"));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        Upload MCQ scores as CSV with headers <code>CID</code>,{" "}
        <code>Seat</code>, <code>MCQ score</code>.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-2 flex flex-wrap items-center gap-3"
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
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload MCQ scores"}
        </button>
      </form>
      {summary && <p className="mt-2 text-sm text-green-700">{summary}</p>}
      {error && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-800">
          {error}
        </pre>
      )}
    </div>
  );
}
