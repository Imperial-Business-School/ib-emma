import Link from "next/link";
import { EXAM_STATUS_LABEL, query, type Exam } from "@/lib/db";
import { createExamAction } from "./actions";
import { ExamSearch } from "./ExamSearch";

export const dynamic = "force-dynamic";

type ExamRow = Exam & { total: number; graded: number };

export default async function AdminHome() {
  const exams = await query<ExamRow>(
    `SELECT e.*,
            (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id)::int AS total,
            (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL)::int AS graded
     FROM exams e
     ORDER BY e.created_at DESC`,
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Admin · Exams</h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin sees everything: seat numbers, CIDs, and grades from both markers.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create exam</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter both markers and pick a sampling mode. The sampling mode is
          locked once primary marking starts.
        </p>
        <form action={createExamAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Exam name (e.g. MATH40001 Analysis I)"
            className="rounded border px-3 py-2 md:col-span-2"
          />
          <input
            name="code"
            placeholder="Module code (optional)"
            className="rounded border px-3 py-2 md:col-span-2"
          />
          <fieldset className="rounded border bg-slate-50 p-3 md:col-span-2">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">
              Second marking
            </legend>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="sampling_mode"
                value="standard"
                defaultChecked
                className="mt-1"
              />
              <span>
                <strong>Standard sampling</strong> — at least 10% of papers,
                including all grade-boundary papers (39–41, 49–51, 59–61, 69–71,
                79–81).
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="sampling_mode"
                value="full"
                className="mt-1"
              />
              <span>
                <strong>Full second marking</strong> — every paper is marked
                by the second marker.
              </span>
            </label>
          </fieldset>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Primary marker
            </p>
            <input
              type="email"
              name="primary_email"
              required
              placeholder="primary@imperial.ac.uk"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
            <input
              name="primary_name"
              placeholder="Name (optional)"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Second marker
            </p>
            <input
              type="email"
              name="secondary_email"
              required
              placeholder="second@imperial.ac.uk"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
            <input
              name="secondary_name"
              placeholder="Name (optional)"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 md:col-span-2"
          >
            Create exam
          </button>
        </form>
      </section>

      <ExamSearch
        exams={exams.map((e) => ({
          id: e.id,
          name: e.name,
          code: e.code,
          status: e.status,
          status_label: EXAM_STATUS_LABEL[e.status],
          total: e.total,
          graded: e.graded,
          created_at: e.created_at,
        }))}
      />
    </div>
  );
}
