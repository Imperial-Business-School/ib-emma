import Link from "next/link";
import { db, type Exam } from "@/lib/db";
import { createExamAction } from "./actions";

export const dynamic = "force-dynamic";

type ExamRow = Exam & { total: number; graded: number };

export default function AdminHome() {
  const exams = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id) AS total,
              (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL) AS graded
       FROM exams e
       ORDER BY e.created_at DESC`,
    )
    .all() as ExamRow[];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Admin · Exams</h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin sees everything: seat numbers, CIDs and grades.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create exam</h2>
        <form action={createExamAction} className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <input
            name="name"
            required
            placeholder="Exam name (e.g. MATH40001 Analysis I)"
            className="rounded border px-3 py-2"
          />
          <input
            name="code"
            placeholder="Module code (optional)"
            className="rounded border px-3 py-2"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Create
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Created</th>
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
                <td className="px-4 py-3 text-slate-600">
                  {e.graded} / {e.total} graded
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(e.created_at + "Z").toLocaleDateString()}
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
