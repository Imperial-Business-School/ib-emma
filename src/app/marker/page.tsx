import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { EXAM_STATUS_LABEL, query, type Exam } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = Exam & {
  total: number;
  primary_graded: number;
  sample_count: number;
  secondary_graded: number;
  marker_role: "primary" | "secondary" | "admin";
};

export default async function MarkerHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/marker");

  const exams =
    user.role === "admin"
      ? await query<Row>(
          `SELECT e.*,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id)::int AS total,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL)::int AS primary_graded,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.in_sample)::int AS sample_count,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.in_sample AND s.secondary_grade IS NOT NULL)::int AS secondary_graded,
                  'admin'::text AS marker_role
           FROM exams e
           WHERE e.status <> 'setup'
           ORDER BY e.created_at DESC`,
        )
      : await query<Row>(
          `SELECT e.*,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id)::int AS total,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL)::int AS primary_graded,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.in_sample)::int AS sample_count,
                  (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.in_sample AND s.secondary_grade IS NOT NULL)::int AS secondary_graded,
                  CASE WHEN e.primary_marker_id = $1 THEN 'primary' ELSE 'secondary' END AS marker_role
           FROM exams e
           WHERE (e.primary_marker_id = $1 OR e.secondary_marker_id = $1)
             AND e.status <> 'setup'
           ORDER BY e.created_at DESC`,
          [user.id],
        );

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
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No exams allocated to you yet.
                </td>
              </tr>
            )}
            {exams.map((e) => {
              const progress =
                e.marker_role === "secondary"
                  ? `${e.secondary_graded} / ${e.sample_count} sampled`
                  : `${e.primary_graded} / ${e.total}`;
              return (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">
                    {e.name}
                    {e.code && (
                      <span className="ml-2 text-xs text-slate-500">
                        {e.code}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    {e.marker_role}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {EXAM_STATUS_LABEL[e.status]}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{progress}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/marker/exams/${e.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
