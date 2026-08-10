import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { query, queryOne, type Exam, type Submission } from "@/lib/db";
import {
  isPrimaryMarkingPhase,
  isSecondaryMarkingPhase,
} from "@/lib/examStatus";
import { sweepDeadlineStatuses } from "@/lib/deadlines";
import { formatDateTime } from "@/lib/datetime";
import {
  completeFinalMarkingByTokenAction,
  completePrimaryMarkingByTokenAction,
  completeSecondaryMarkingByTokenAction,
  setGradeBySeatByTokenAction,
} from "./actions";
import { GradeTable, type GradeRow } from "./GradeTable";
import { MarkerUploadPanel } from "./MarkerUploadPanel";

export const dynamic = "force-dynamic";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

type MarkerRole = "primary" | "secondary";

export default async function MarkerByTokenPage({
  params,
}: {
  params: Promise<{ examId: string; token: string }>;
}) {
  const { examId: rawId, token } = await params;
  const examId = Number(rawId);
  if (!Number.isFinite(examId)) notFound();

  const origin = await getOrigin();
  await sweepDeadlineStatuses({ origin, examId });

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

  // Primary marker in 'review' status is resolving discrepancies.
  const isResolving = isPrimary && exam.status === "review";

  // Source rows for the table view.
  const rawRows = isResolving
    ? await query<Submission>(
        // Show every row that had a discrepancy at second-marking time,
        // including ones the primary has already resolved -- so the row
        // doesn't vanish after saving and they can edit if needed.
        `SELECT * FROM submissions
         WHERE exam_id = $1
           AND in_sample = true
           AND grade IS DISTINCT FROM secondary_grade
         ORDER BY length(seat_number), seat_number`,
        [examId],
      )
    : isSecondary
      ? await query<Submission>(
          // In 'full' sampling mode, second marker sees every seat
          // (including absent students, whose row is unmarkable). In
          // 'standard' mode they only see the sample.
          exam.sampling_mode === "full"
            ? `SELECT * FROM submissions
               WHERE exam_id = $1
               ORDER BY length(seat_number), seat_number`
            : `SELECT * FROM submissions
               WHERE exam_id = $1 AND in_sample = true
               ORDER BY length(seat_number), seat_number`,
          [examId],
        )
      : await query<Submission>(
          `SELECT * FROM submissions
           WHERE exam_id = $1
           ORDER BY length(seat_number), seat_number`,
          [examId],
        );

  const tableRows: GradeRow[] = rawRows.map((r) =>
    isResolving
      ? {
          id: r.id,
          seat_number: r.seat_number,
          current_grade: r.final_grade,
          saved_at: r.final_graded_at,
          current_comment: r.final_comment,
          primary_grade: r.grade,
          primary_comment: r.primary_comment,
          secondary_grade: r.secondary_grade,
          secondary_comment: r.secondary_comment,
          absent: r.absent,
          mcq_score: r.mcq_score,
        }
      : isSecondary
        ? {
            id: r.id,
            seat_number: r.seat_number,
            current_grade: r.secondary_grade,
            saved_at: r.secondary_graded_at,
            current_comment: r.secondary_comment,
            primary_grade: r.grade,
            absent: r.absent,
            mcq_score: r.mcq_score,
          }
        : {
            id: r.id,
            seat_number: r.seat_number,
            current_grade: r.grade,
            saved_at: r.graded_at,
            current_comment: r.primary_comment,
            absent: r.absent,
            mcq_score: r.mcq_score,
          },
  );

  const markingOpen =
    isResolving ||
    (isPrimary && isPrimaryMarkingPhase(exam.status)) ||
    (isSecondary && isSecondaryMarkingPhase(exam.status));

  const myDeadline =
    isPrimary && exam.primary_deadline
      ? new Date(exam.primary_deadline)
      : isSecondary && exam.secondary_deadline
        ? new Date(exam.secondary_deadline)
        : null;
  const showLateBanner =
    exam.status === "first_marking_late" ||
    exam.status === "second_marking_late";
  const showOverdueBanner =
    !showLateBanner &&
    (exam.status === "first_marking_overdue" ||
      exam.status === "second_marking_overdue");

  // Absent students can never be graded, so exclude them from the
  // "graded / total" ratio and the completeness check.
  const gradableRows = tableRows.filter((r) => !r.absent);
  const total = gradableRows.length;
  const graded = gradableRows.filter((r) => r.current_grade != null).length;
  const canComplete = markingOpen && total > 0 && graded === total;

  const headerText = isResolving
    ? "Discrepancies to review"
    : isSecondary
      ? "second marker"
      : "primary marker";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{exam.name}</h1>
        {exam.code && <p className="text-sm text-slate-600">{exam.code}</p>}
        {isResolving ? (
          <p className="mt-2 text-sm text-slate-600">
            <strong>Final marking.</strong> Review each discrepancy below
            between your grade and the second marker&apos;s, and submit a
            final grade. {graded} of {total} resolved.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            You are the <strong>{headerText}</strong>. {graded} of {total}{" "}
            {isSecondary ? "sampled seats" : "seats"} graded.
          </p>
        )}
        {myDeadline && !isResolving && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              showLateBanner
                ? "border-red-300 bg-red-50 text-red-900"
                : showOverdueBanner
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <span className="font-semibold">
              {showLateBanner
                ? "Marking is LATE — please submit immediately."
                : showOverdueBanner
                  ? "Marking is OVERDUE — please submit as soon as possible."
                  : "Deadline"}
            </span>{" "}
            <span>
              Your grades must be submitted by{" "}
              <strong>{formatDateTime(myDeadline)}</strong> (UK time).
            </span>
          </div>
        )}
      </div>

      {!markingOpen && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {isPrimary && exam.status === "setup" && (
            <>The admin hasn&apos;t started marking yet.</>
          )}
          {isPrimary && exam.status === "first_marking_review" && (
            <>You have completed your marking. The admin is reviewing the second-marking sample.</>
          )}
          {isPrimary && exam.status === "secondary_marking" && (
            <>You have completed your marking. The second marker is now reviewing a sample.</>
          )}
          {isSecondary &&
            (exam.status === "setup" ||
              exam.status === "primary_marking" ||
              exam.status === "first_marking_review") && (
              <>The primary marker is still working, or the admin is reviewing the sample. You&apos;ll be notified when it&apos;s your turn.</>
            )}
          {exam.status === "review" && isSecondary && (
            <>Your marking is complete. The primary marker is reviewing discrepancies.</>
          )}
          {exam.status === "complete" && (
            <>This exam is closed for marker edits.</>
          )}
        </div>
      )}

      {markingOpen && !isResolving && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Quick entry</h2>
          <p className="mt-1 text-sm text-slate-600">
            Type a seat number and grade, then press Enter. Grades must be a
            number with at most one decimal place (e.g. 70 or 70.5).
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
              pattern="^\d+(\.\d)?$"
              inputMode="decimal"
              title="A number with at most one decimal place, e.g. 70 or 70.5"
              className="w-32 rounded border px-3 py-2 text-sm"
            />
            <input
              name="comment"
              placeholder="Comment (optional)"
              className="flex-1 min-w-48 rounded border px-3 py-2 text-sm"
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

      {markingOpen && !isResolving && (
        <MarkerUploadPanel examId={examId} token={token} />
      )}

      <GradeTable
        examId={examId}
        token={token}
        rows={tableRows}
        isSecondary={isSecondary}
        isResolving={isResolving}
        markingOpen={markingOpen}
        mcqEnabled={exam.mcq_enabled}
      />

      {markingOpen && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          {isResolving ? (
            <form
              action={async () => {
                "use server";
                await completeFinalMarkingByTokenAction(examId, token);
              }}
            >
              <button
                type="submit"
                disabled={!canComplete}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Final marking complete
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Marks all discrepancies as resolved and returns the exam to
                Ready for Canvas upload.
              </p>
            </form>
          ) : isPrimary ? (
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
                Locks in your grades and hands over to the admin to review the
                second-marking sample before the second marker is notified.
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
                Locks in your grades. The primary marker will be asked to
                resolve any discrepancies.
              </p>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
