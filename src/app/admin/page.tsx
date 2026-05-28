import Link from "next/link";
import { EXAM_STATUS_LABEL, query, type Exam } from "@/lib/db";
import { createExamAction } from "./actions";

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
          Enter both markers now. The primary marker will be emailed a sign-in
          link when you click <em>Start primary marking</em> on the next page.
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

      <section className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No exams yet. Create one above.
                </td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.code ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.graded} / {e.total} primary
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/exams/${e.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: Exam["status"] }) {
  const styles: Record<Exam["status"], string> = {
    setup: "bg-slate-100 text-slate-700",
    primary_marking: "bg-blue-100 text-blue-800",
    secondary_marking: "bg-indigo-100 text-indigo-800",
    complete: "bg-green-100 text-green-800",
    review: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {EXAM_STATUS_LABEL[status]}
    </span>
  );
}
