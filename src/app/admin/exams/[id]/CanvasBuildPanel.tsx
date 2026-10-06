"use client";

import { useRef, useState, useTransition } from "react";

type Report = {
  assignmentHeader: string;
  gradesWritten: number;
  unmatched: Array<{ seat_number: string; cid: string }>;
  canvasRowCount: number;
};

// Posts the admin-chosen Canvas gradebook export to EMMS, downloads the
// enriched CSV in-browser once the server replies, and shows a short
// summary of what matched / what didn't.
export function CanvasBuildPanel({ examId }: { examId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setReport(null);
    startTransition(async () => {
      let res: Response;
      try {
        res = await fetch(`/api/exams/${examId}/canvas-build`, {
          method: "POST",
          body: fd,
        });
      } catch {
        setError("Could not reach the server. Try again.");
        return;
      }
      let payload:
        | {
            csv?: string;
            filename?: string;
            report?: Report;
            error?: string;
          }
        | null = null;
      try {
        payload = await res.json();
      } catch {
        setError(`Unexpected server response (${res.status}).`);
        return;
      }
      if (!res.ok || !payload?.csv) {
        setError(payload?.error ?? `Server returned ${res.status}.`);
        return;
      }
      // Trigger a download of the returned CSV.
      const blob = new Blob([payload.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename ?? "canvas_upload.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = "";
      setReport(payload.report ?? null);
    });
  }

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Build Canvas upload file</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          In Canvas, go to the course Gradebook → Actions → Export → wait
          for the CSV to download.
        </li>
        <li>
          Upload that CSV below. EMMS adds this exam&apos;s final grades
          in a new column named after the exam.
        </li>
        <li>
          Download the resulting file and import it back into the Canvas
          Gradebook. Canvas will match students on name and ID
          automatically — no manual picker.
        </li>
      </ol>
      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Building…" : "Build & download"}
        </button>
      </form>
      {report && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <p>
            <strong>{report.gradesWritten}</strong> grade
            {report.gradesWritten === 1 ? "" : "s"} written into the{" "}
            <code>{report.assignmentHeader}</code> column across{" "}
            {report.canvasRowCount} Canvas row
            {report.canvasRowCount === 1 ? "" : "s"}.
          </p>
          {report.unmatched.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold">
                {report.unmatched.length} EMMS seat
                {report.unmatched.length === 1 ? "" : "s"} had no match in the
                Canvas file:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {report.unmatched.slice(0, 20).map((u) => (
                  <li key={u.cid}>
                    Seat {u.seat_number} (CID {u.cid})
                  </li>
                ))}
                {report.unmatched.length > 20 && (
                  <li className="text-slate-600">
                    …and {report.unmatched.length - 20} more.
                  </li>
                )}
              </ul>
              <p className="mt-1 text-xs text-slate-600">
                These students are in EMMS but not in the Canvas Gradebook
                export. Likely a Canvas enrollment issue — resolve on Canvas,
                re-export, and run this again.
              </p>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
