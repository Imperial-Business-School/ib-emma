import Link from "next/link";
import { db, type Exam } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = Exam & { total: number; graded: number };

export default function MarkerHome() {
  const exams = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id) AS total,
              (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL) AS graded
       FROM exams e
       WHERE (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id) > 0
       ORDER BY e.created_at DESC`,
    )
    .all() as Row[];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Marker · Exams</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter grades by seat number. Student CIDs are not shown.
        </p>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Exam</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No exams available for marking yet.
                </td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.code ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.graded} / {e.total}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/marker/exams/${e.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Mark →
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
