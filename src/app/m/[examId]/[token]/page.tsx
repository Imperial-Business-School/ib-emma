import { notFound } from "next/navigation";
import { query, queryOne, type Exam, type Submission } from "@/lib/db";
import {
  completePrimaryMarkingByTokenAction,
  completeSecondaryMarkingByTokenAction,
  setGradeBySeatByTokenAction,
} from "./actions";
import { GradeTable, type GradeRow } from "./GradeTable";

export const dynamic = "force-dynamic";

type MarkerRole = "primary" | "secondary";

export default async function MarkerByTokenPage({
  params,
}: {
  params: Promise<{ examId: string; token: string }>;
}) {
  const { examId: rawId, token } = await params;
  const examId = Number(rawId);
  if (!Number.isFinite(examId)) notFound();

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) notFound();

  let role: MarkerRole;
  if (token && token === exam.primary_access_token) role = "primary";
  else if (token && token === exam.secondary_access_token) role = "secondary";
  else notFound();

  const isPrimary = role === "primary";
  const isSecondary = role === "secondary";

  const rawRows = isSecondary
    ? await query<
        Pick<
          Submission,
          | "id"
          | "seat_number"
          | "grade"
          | "secondary_grade"
          | "secondary_graded_at"
          | "in_sample"
        >
      >(
        `SELECT id, seat_number, grade, secondary_grade, secondary_graded_at, in_sample
         FROM submissions
         WHERE exam_id = $1 AND in_sample = true
         ORDER BY length(seat_number), seat_number`,
        [examId],
      )
    : await query<
        Pick<
          Submission,
          "id" | "seat_number" | "grade" | "graded_at" | "in_sample"
        >
      >(
        `SELECT id, seat_number, grade, graded_at, in_sample
         FROM submissions
         WHERE exam_id = $1
         ORDER BY length(seat_number), seat_number`,
        [examId],
      );

  const tableRows: GradeRow[] = rawRows.map((r) =>
    isSecondary
      ? {
          id: r.id,
          seat_number: r.seat_number,
          current_grade: "secondary_grade" in r ? r.secondary_grade : null,
          saved_at:
            "secondary_graded_at" in r ? r.secondary_graded_at : null,
          primary_grade: r.grade,
        }
      : {
          id: r.id,
          seat_number: r.seat_number,
          current_grade: r.grade,
          saved_at: "graded_at" in r ? r.graded_at : null,
        },
  );

  const markingOpen =
    (isPrimary && exam.status === "primary_marking") ||
    (isSecondary && exam.status === "secondary_marking");

  const total = tableRows.length;
  const graded = tableRows.filter((r) => r.current_grade != null).length;
  const canComplete = markingOpen && total > 0 && graded === total;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{exam.name}</h1>
        {exam.code && <p className="text-sm text-slate-600">{exam.code}</p>}
        <p className="mt-2 text-sm text-slate-600">
          You are the{" "}
          <strong>{isSecondary ? "second" : "primary"} marker</strong>.{" "}
          {graded} of {total}{" "}
          {isSecondary ? "sampled seats" : "seats"} graded.
        </p>
      </div>

      {!markingOpen && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {isPrimary && exam.status === "setup" && (
            <>The admin hasn&apos;t started marking yet.</>
          )}
          {isPrimary && exam.status === "secondary_marking" && (
            <>You have completed your marking. The second marker is now reviewing a sample.</>
          )}
          {isSecondary &&
            (exam.status === "setup" || exam.status === "primary_marking") && (
              <>The primary marker is still working. You&apos;ll be able to start second-marking once a sample is ready.</>
            )}
          {(exam.status === "complete" || exam.status === "review") && (
            <>This exam is closed for marker edits.</>
          )}
        </div>
      )}

      {markingOpen && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Quick entry</h2>
          <p className="mt-1 text-sm text-slate-600">
            Type a seat number and grade, then press Enter. Useful when working
            through a stack of papers.
          </p>
          <form
            action={async (fd) => {
              "use server";
              await setGradeBySeatByTokenAction(examId, token, fd);
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
      )}

      <GradeTable
        examId={examId}
        token={token}
        rows={tableRows}
        isSecondary={isSecondary}
        markingOpen={markingOpen}
      />

      {markingOpen && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          {isPrimary ? (
            <form
              action={async () => {
                "use server";
                await completePrimaryMarkingByTokenAction(examId, token);
              }}
            >
              <button
                type="submit"
                disabled={!canComplete}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Marking is complete
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Locks in your grades and picks the second-marking sample
                (boundary grades plus a random fill of at least 10% of papers).
              </p>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await completeSecondaryMarkingByTokenAction(examId, token);
              }}
            >
              <button
                type="submit"
                disabled={!canComplete}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Marking is complete
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Locks in your grades. The admin will resolve any discrepancies
                of 6 points or more before the Canvas CSV can be downloaded.
              </p>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
