import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EXAM_STATUS_LABEL,
  query,
  queryOne,
  type Exam,
  type Submission,
  type User,
} from "@/lib/db";
import {
  addSeatAction,
  deleteExamAction,
  deleteSeatAction,
  reassignMarkerAction,
  resolveReviewAction,
  startPrimaryMarkingAction,
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
  const primaryMarker = exam.primary_marker_id
    ? ((await queryOne<User>("SELECT * FROM users WHERE id = $1", [
        exam.primary_marker_id,
      ])) ?? null)
    : null;
  const secondaryMarker = exam.secondary_marker_id
    ? ((await queryOne<User>("SELECT * FROM users WHERE id = $1", [
        exam.secondary_marker_id,
      ])) ?? null)
    : null;

  const totalSeats = submissions.length;
  const primaryGraded = submissions.filter((s) => s.grade !== null).length;
  const sampleCount = submissions.filter((s) => s.in_sample).length;
  const secondaryGraded = submissions.filter(
    (s) => s.in_sample && s.secondary_grade !== null,
  ).length;
  const discrepancies = submissions.filter(
    (s) => s.in_sample && s.grade !== s.secondary_grade,
  );
  const canStartMarking =
    exam.status === "setup" && totalSeats > 0 && exam.primary_marker_id;
  const canDownloadCsv = exam.status === "complete" || exam.status === "review";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← All exams
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{exam.name}</h1>
          {exam.code && <p className="text-sm text-slate-600">{exam.code}</p>}
          <p className="mt-2">
            <StatusBadge status={exam.status} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canDownloadCsv ? (
            <a
              href={`/api/exams/${exam.id}/canvas.csv`}
              className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Download Canvas CSV
            </a>
          ) : (
            <span
              className="rounded border bg-slate-50 px-3 py-2 text-sm text-slate-400"
              title="Available once both markers complete"
            >
              Download Canvas CSV
            </span>
          )}
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

      {exam.status === "review" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">
            {discrepancies.length} discrepanc
            {discrepancies.length === 1 ? "y" : "ies"} between markers
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            Reconcile out-of-band with the markers, then mark as resolved to
            enable the Canvas CSV download.
          </p>
          <form
            action={async () => {
              "use server";
              await resolveReviewAction(exam.id);
            }}
            className="mt-3"
          >
            <button
              type="submit"
              className="rounded border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Mark resolved → Ready for Canvas upload
            </button>
          </form>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <MarkerCard
          role="primary"
          examId={exam.id}
          marker={primaryMarker}
          completedAt={exam.primary_completed_at}
        />
        <MarkerCard
          role="secondary"
          examId={exam.id}
          marker={secondaryMarker}
          completedAt={exam.secondary_completed_at}
        />
      </section>

      {exam.status === "setup" && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Seats (seat → CID)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload a two-column CSV (<code>seat_number, cid</code>, header row
            optional) or add a single row.
          </p>
          <form
            action={async (fd) => {
              "use server";
              await uploadSeatsAction(exam.id, fd);
            }}
            className="mt-3 flex items-center gap-3"
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

          <form
            action={async (fd) => {
              "use server";
              await addSeatAction(exam.id, fd);
            }}
            className="mt-3 flex gap-2"
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
              Add seat
            </button>
          </form>

          {canStartMarking && (
            <form
              action={async () => {
                "use server";
                await startPrimaryMarkingAction(exam.id);
              }}
              className="mt-6 border-t pt-4"
            >
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Start primary marking → Email primary marker
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Sends a magic-link sign-in to {primaryMarker?.email}.
              </p>
            </form>
          )}
        </section>
      )}

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">
            All seats ({totalSeats}) · primary {primaryGraded}/{totalSeats}
            {sampleCount > 0 && (
              <span className="text-slate-500">
                {" "}
                · secondary {secondaryGraded}/{sampleCount}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">
            Markers never see the CID column. ★ marks rows in the second-marking
            sample.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Seat</th>
              <th className="px-4 py-2">CID</th>
              <th className="px-4 py-2">Primary grade</th>
              <th className="px-4 py-2">Sample</th>
              <th className="px-4 py-2">Secondary grade</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No seats uploaded yet.
                </td>
              </tr>
            )}
            {submissions.map((s) => {
              const mismatch =
                s.in_sample && s.grade !== null && s.secondary_grade !== null
                  ? s.grade !== s.secondary_grade
                  : false;
              return (
                <tr
                  key={s.id}
                  className={`border-b last:border-b-0 ${mismatch ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-2 font-mono">{s.seat_number}</td>
                  <td className="px-4 py-2 font-mono">{s.cid}</td>
                  <td className="px-4 py-2">
                    {s.grade ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {s.in_sample ? <span title="In sample">★</span> : ""}
                  </td>
                  <td className="px-4 py-2">
                    {s.in_sample ? (
                      mismatch ? (
                        <span className="font-medium text-amber-900">
                          {s.secondary_grade}
                        </span>
                      ) : (
                        (s.secondary_grade ?? (
                          <span className="text-slate-400">—</span>
                        ))
                      )
                    ) : (
                      <span className="text-slate-300">n/a</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {exam.status === "setup" && (
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
                    )}
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

function MarkerCard({
  role,
  examId,
  marker,
  completedAt,
}: {
  role: "primary" | "secondary";
  examId: number;
  marker: User | null;
  completedAt: string | null;
}) {
  const heading = role === "primary" ? "Primary marker" : "Second marker";
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">
        {heading}
      </p>
      {marker ? (
        <>
          <p className="mt-1 font-medium">{marker.name ?? marker.email}</p>
          {marker.name && (
            <p className="text-sm text-slate-600">{marker.email}</p>
          )}
          {completedAt && (
            <p className="mt-1 text-xs text-green-700">
              Completed {new Date(completedAt).toLocaleString()}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-400">Not set</p>
      )}
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer hover:text-slate-900">
          Reassign
        </summary>
        <form
          action={async (fd) => {
            "use server";
            await reassignMarkerAction(examId, role, fd);
          }}
          className="mt-2 flex flex-col gap-2"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="email@imperial.ac.uk"
            className="rounded border px-2 py-1 text-sm"
          />
          <input
            name="name"
            placeholder="Name (optional)"
            className="rounded border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
          >
            Save
          </button>
        </form>
      </details>
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
