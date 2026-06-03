import Link from "next/link";
import { headers } from "next/headers";
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
  deleteSeatAction,
  reassignMarkerAction,
  regenerateMarkerTokenAction,
  startPrimaryMarkingAction,
  startSecondaryMarkingAction,
  toggleInSampleAction,
  uploadSeatsAction,
} from "../../actions";
import { DeleteExamForm } from "./DeleteExamForm";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

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

  const origin = await getOrigin();
  const primaryUrl = exam.primary_access_token
    ? `${origin}/m/${exam.id}/${exam.primary_access_token}`
    : null;
  const secondaryUrl = exam.secondary_access_token
    ? `${origin}/m/${exam.id}/${exam.secondary_access_token}`
    : null;

  const submissions = await query<Submission>(
    "SELECT * FROM submissions WHERE exam_id = $1 ORDER BY length(seat_number), seat_number",
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
  const showFinalColumn =
    exam.status === "review" || exam.status === "complete";
  const canStartMarking =
    exam.status === "setup" && totalSeats > 0 && exam.primary_marker_id;
  const isFirstMarkingReview = exam.status === "first_marking_review";
  const canDownloadCsv = exam.status === "complete";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← All exams
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{exam.name}</h1>
          {exam.code && <p className="text-sm text-slate-600">{exam.code}</p>}
          <p className="mt-2 flex items-center gap-2">
            <StatusBadge status={exam.status} />
            <span className="text-xs text-slate-500">
              {exam.sampling_mode === "full"
                ? "Full second marking"
                : "Standard sampling (10% + boundaries)"}
            </span>
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
              title="Available once every seat has a final grade"
            >
              Download Canvas CSV
            </span>
          )}
          <a
            href={`/api/exams/${exam.id}/audit.csv`}
            className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Download audit CSV
          </a>
        </div>
      </div>

      {isFirstMarkingReview && (
        <div className="rounded-lg border border-purple-300 bg-purple-50 p-4">
          <h3 className="font-semibold text-purple-900">
            Review the second-marking sample
          </h3>
          <p className="mt-1 text-sm text-purple-800">
            {sampleCount} of {totalSeats} seats are currently selected for
            second marking. Click the star on any row below to add or remove a
            seat. When you&apos;re happy, click <em>Start second marking</em>.
          </p>
          <form
            action={async () => {
              "use server";
              await startSecondaryMarkingAction(exam.id);
            }}
            className="mt-3"
          >
            <button
              type="submit"
              disabled={sampleCount === 0}
              className="rounded bg-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Start second marking → notify second marker
            </button>
          </form>
        </div>
      )}

      {exam.status === "review" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">
            Awaiting primary marker review of discrepancies
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            The primary marker has been notified to resolve each discrepancy
            below. When they finish, the exam returns to <em>Ready for Canvas upload</em>.
          </p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <MarkerCard
          role="primary"
          examId={exam.id}
          marker={primaryMarker}
          completedAt={exam.primary_completed_at}
          shareUrl={primaryUrl}
          status={exam.status}
        />
        <MarkerCard
          role="secondary"
          examId={exam.id}
          marker={secondaryMarker}
          completedAt={exam.secondary_completed_at}
          shareUrl={secondaryUrl}
          status={exam.status}
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
                Start primary marking
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Sampling mode locks at this point. Send the primary marker URL
                shown above to {primaryMarker?.email ?? "the primary marker"}.
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
            Markers never see the CID column.{" "}
            {isFirstMarkingReview
              ? "Click the star to toggle whether a seat is in the second-marking sample."
              : "★ marks rows in the second-marking sample."}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Seat</th>
              <th className="px-4 py-2">CID</th>
              <th className="px-4 py-2">Primary grade</th>
              <th className="px-4 py-2">Comment</th>
              <th className="px-4 py-2 text-center">Sample</th>
              <th className="px-4 py-2">Secondary grade</th>
              <th className="px-4 py-2">Comment</th>
              {showFinalColumn && <th className="px-4 py-2">Final grade</th>}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr>
                <td
                  colSpan={showFinalColumn ? 9 : 8}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No seats uploaded yet.
                </td>
              </tr>
            )}
            {submissions.map((s) => {
              const needsResolution =
                showFinalColumn && s.in_sample && s.final_grade === null;
              const mismatch =
                s.in_sample &&
                s.grade !== null &&
                s.secondary_grade !== null &&
                s.grade !== s.secondary_grade;
              const rowClass = needsResolution
                ? "bg-amber-100"
                : mismatch
                  ? "bg-amber-50"
                  : "";
              return (
                <tr
                  key={s.id}
                  className={`border-b last:border-b-0 align-top ${rowClass}`}
                >
                  <td className="px-4 py-2 font-mono">{s.seat_number}</td>
                  <td className="px-4 py-2 font-mono">{s.cid}</td>
                  <td className="px-4 py-2">
                    {s.grade ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {s.primary_comment ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {isFirstMarkingReview ? (
                      <form
                        action={async () => {
                          "use server";
                          await toggleInSampleAction(exam.id, s.id);
                        }}
                      >
                        <button
                          type="submit"
                          aria-label={
                            s.in_sample
                              ? "Remove from sample"
                              : "Add to sample"
                          }
                          className="cursor-pointer text-lg leading-none hover:opacity-70"
                          title={
                            s.in_sample
                              ? "Click to remove from sample"
                              : "Click to add to sample"
                          }
                        >
                          {s.in_sample ? "★" : "☆"}
                        </button>
                      </form>
                    ) : s.in_sample ? (
                      <span title="In sample">★</span>
                    ) : (
                      <span className="text-slate-300">☆</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.in_sample ? (
                      (s.secondary_grade ?? (
                        <span className="text-slate-400">—</span>
                      ))
                    ) : (
                      <span className="text-slate-300">n/a</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {s.in_sample ? (
                      (s.secondary_comment ?? (
                        <span className="text-slate-400">—</span>
                      ))
                    ) : (
                      <span className="text-slate-300">n/a</span>
                    )}
                  </td>
                  {showFinalColumn && (
                    <td className="px-4 py-2">
                      {needsResolution ? (
                        <span className="text-xs text-amber-900">
                          awaiting primary
                        </span>
                      ) : (
                        <span className="font-medium">
                          {s.final_grade ?? (
                            <span className="text-slate-400">—</span>
                          )}
                        </span>
                      )}
                    </td>
                  )}
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

      <section className="border-t pt-6">
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-900">
            Danger zone
          </summary>
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <DeleteExamForm examId={exam.id} examName={exam.name} />
          </div>
        </details>
      </section>
    </div>
  );
}

function MarkerCard({
  role,
  examId,
  marker,
  completedAt,
  shareUrl,
  status,
}: {
  role: "primary" | "secondary";
  examId: number;
  marker: User | null;
  completedAt: string | null;
  shareUrl: string | null;
  status: Exam["status"];
}) {
  const heading = role === "primary" ? "Primary marker" : "Second marker";
  const activeNow =
    (role === "primary" &&
      (status === "primary_marking" || status === "review")) ||
    (role === "secondary" && status === "secondary_marking");
  const hint =
    role === "primary"
      ? status === "setup"
        ? "Send once you click Start primary marking."
        : status === "primary_marking"
          ? "Send this URL to the primary marker."
          : status === "review"
            ? "Send this URL to the primary marker to resolve discrepancies."
            : "Primary marking is finished."
      : status === "setup" ||
          status === "primary_marking" ||
          status === "first_marking_review"
        ? "Send once you click Start second marking."
        : status === "secondary_marking"
          ? "Send this URL to the second marker."
          : "Second marking is finished.";

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-slate-500">
          {heading}
        </p>
        {activeNow && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            Active
          </span>
        )}
      </div>
      {marker ? (
        <>
          <p className="mt-1 font-medium">{marker.name ?? marker.email}</p>
          {marker.name && (
            <p className="text-sm text-slate-600">{marker.email}</p>
          )}
          {completedAt && (
            <p className="mt-1 text-xs text-green-700">
              Completed {formatDateTime(completedAt)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-400">Not set</p>
      )}

      {shareUrl && (
        <div className="mt-3">
          <p className="text-xs text-slate-500">Marker URL</p>
          <input
            readOnly
            value={shareUrl}
            className="mt-1 w-full rounded border bg-slate-50 px-2 py-1 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
          <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer hover:text-slate-900">
              Regenerate URL (invalidates the previous link)
            </summary>
            <form
              action={async () => {
                "use server";
                await regenerateMarkerTokenAction(examId, role);
              }}
              className="mt-2"
            >
              <button
                type="submit"
                className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
              >
                Regenerate
              </button>
            </form>
          </details>
        </div>
      )}

      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer hover:text-slate-900">
          Reassign marker
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
    first_marking_review: "bg-purple-100 text-purple-800",
    secondary_marking: "bg-indigo-100 text-indigo-800",
    review: "bg-amber-100 text-amber-800",
    complete: "bg-green-100 text-green-800",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {EXAM_STATUS_LABEL[status]}
    </span>
  );
}
