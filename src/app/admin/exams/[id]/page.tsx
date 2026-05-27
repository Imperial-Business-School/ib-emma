import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne, type Exam, type Submission } from "@/lib/db";
import {
  addSeatAction,
  deleteExamAction,
  deleteSeatAction,
  uploadSeatsAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) notFound();

  const submissions = await query<Submission>(
    "SELECT * FROM submissions WHERE exam_id = $1 ORDER BY seat_number",
    [examId],
  );

  const total = submissions.length;
  const graded = submissions.filter((s) => s.grade !== null).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← All exams
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{exam.name}</h1>
          {exam.code && (
            <p className="text-sm text-slate-600">{exam.code}</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {graded} of {total} graded
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/exams/${exam.id}/canvas.csv`}
            className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Download Canvas CSV
          </a>
          <form
            action={async () => {
              "use server";
              await deleteExamAction(exam.id);
            }}
          >
            <button
              type="submit"
              className="rounded border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Delete exam
            </button>
          </form>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Upload seat → CID CSV</h2>
        <p className="mt-1 text-sm text-slate-600">
          Two columns: <code>seat_number, cid</code>. A header row is optional.
          Re-uploading updates any existing seat mappings.
        </p>
        <form
          action={async (fd) => {
            "use server";
            await uploadSeatsAction(exam.id, fd);
          }}
          className="mt-4 flex items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Upload
          </button>
        </form>

        <h3 className="mt-6 text-sm font-semibold text-slate-700">
          Or add a single seat
        </h3>
        <form
          action={async (fd) => {
            "use server";
            await addSeatAction(exam.id, fd);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="seat"
            placeholder="Seat number"
            required
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="cid"
            placeholder="CID"
            required
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">All seats (admin view)</h2>
          <p className="text-xs text-slate-500">
            Markers never see the CID column.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Seat</th>
              <th className="px-4 py-2">CID</th>
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2">Graded at</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No seats uploaded yet.
                </td>
              </tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono">{s.seat_number}</td>
                <td className="px-4 py-2 font-mono">{s.cid}</td>
                <td className="px-4 py-2">
                  {s.grade ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {s.graded_at
                    ? new Date(s.graded_at).toLocaleString()
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <form
                    action={async () => {
                      "use server";
                      await deleteSeatAction(exam.id, s.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
