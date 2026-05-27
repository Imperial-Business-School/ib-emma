import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type Exam, type Submission } from "@/lib/db";
import { setGradeAction, setGradeBySeatAction } from "../../actions";

export const dynamic = "force-dynamic";

type MarkerSubmission = Pick<
  Submission,
  "id" | "seat_number" | "grade" | "graded_at"
>;

export default async function MarkerExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examId) as
    | Exam
    | undefined;
  if (!exam) notFound();

  // Marker query: deliberately excludes the cid column.
  const submissions = db
    .prepare(
      `SELECT id, seat_number, grade, graded_at
       FROM submissions
       WHERE exam_id = ?
       ORDER BY seat_number`,
    )
    .all(examId) as MarkerSubmission[];

  const total = submissions.length;
  const graded = submissions.filter((s) => s.grade !== null).length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/marker" className="text-sm text-blue-600 hover:underline">
          ← All exams
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{exam.name}</h1>
        {exam.code && <p className="text-sm text-slate-600">{exam.code}</p>}
        <p className="mt-1 text-sm text-slate-600">
          {graded} of {total} graded
        </p>
      </div>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Quick entry</h2>
        <p className="mt-1 text-sm text-slate-600">
          Type a seat number and grade, then press Enter. Useful when working
          through a stack of papers.
        </p>
        <form
          action={async (fd) => {
            "use server";
            await setGradeBySeatAction(exam.id, fd);
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            name="seat"
            placeholder="Seat"
            required
            autoFocus
            className="w-32 rounded border px-3 py-2 text-sm font-mono"
          />
          <input
            name="grade"
            placeholder="Grade"
            required
            className="w-32 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Save
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">All seats</h2>
          <p className="text-xs text-slate-500">
            CIDs are hidden from markers.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 w-1/4">Seat</th>
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2 w-1/4">Last saved</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No seats uploaded for this exam yet.
                </td>
              </tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono">{s.seat_number}</td>
                <td className="px-4 py-2">
                  <form
                    action={async (fd) => {
                      "use server";
                      await setGradeAction(exam.id, s.id, fd);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="grade"
                      defaultValue={s.grade ?? ""}
                      placeholder="—"
                      className="w-32 rounded border px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {s.graded_at
                    ? new Date(s.graded_at + "Z").toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
