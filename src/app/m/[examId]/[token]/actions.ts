"use server";

import { revalidatePath } from "next/cache";
import { isValidGrade, query, queryOne, type Exam } from "@/lib/db";
import {
  isPrimaryMarkingPhase,
  isSecondaryMarkingPhase,
} from "@/lib/examStatus";
import { computeFinalGrade } from "@/lib/finalGrade";
import { computeSampleIdsForMode } from "@/lib/sampling";

type MarkerRole = "primary" | "secondary";

type AccessContext = { exam: Exam; role: MarkerRole };

async function authorize(
  examId: number,
  token: string,
): Promise<AccessContext> {
  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");
  if (!token) throw new Error("Missing access token");
  if (token === exam.primary_access_token) return { exam, role: "primary" };
  if (token === exam.secondary_access_token) return { exam, role: "secondary" };
  throw new Error("Invalid access token");
}

// A marker is "in their phase" if the exam is in their active marking
// status OR an overdue/late variant of it. Overdue/late doesn't block the
// marker -- they can still save and complete grades.
function isInMarkerPhase(
  role: MarkerRole,
  status: Exam["status"],
): boolean {
  return role === "primary"
    ? isPrimaryMarkingPhase(status)
    : isSecondaryMarkingPhase(status);
}

export async function saveGradesByTokenAction(
  examId: number,
  token: string,
  updates: { id: number; grade: string; comment?: string | null }[],
): Promise<{ id: number; saved_at: string | null }[]> {
  const { exam, role } = await authorize(examId, token);
  const isPrimary = role === "primary";

  // Marker phase write OR primary marker resolving review discrepancies.
  const inMarkingPhase = isInMarkerPhase(role, exam.status);
  const inResolutionPhase = isPrimary && exam.status === "review";
  if (!inMarkingPhase && !inResolutionPhase) {
    throw new Error("Marking is not currently open for you on this exam");
  }

  const ids = updates.map((u) => u.id);
  if (ids.length === 0) return [];

  for (const u of updates) {
    if (!isValidGrade(u.grade.trim())) {
      throw new Error(
        `Grade "${u.grade}" must be a number with at most one decimal place`,
      );
    }
  }

  const rows = await query<{
    id: number;
    in_sample: boolean;
    grade: string | null;
    secondary_grade: string | null;
  }>(
    `SELECT id, in_sample, grade, secondary_grade FROM submissions
     WHERE exam_id = $1 AND id = ANY($2::int[])`,
    [examId, ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const u of updates) {
    const row = byId.get(u.id);
    if (!row) throw new Error(`Submission ${u.id} not found for this exam`);
    if (role === "secondary" && !row.in_sample) {
      throw new Error("One or more seats are not in the second-marking sample");
    }
    if (inResolutionPhase) {
      // Primary resolution: only allowed on rows that need it (mismatch in
      // sample). Marking other rows risks rewriting confirmed final grades.
      if (!row.in_sample || row.grade === row.secondary_grade) {
        throw new Error("That seat does not need primary-marker review");
      }
    }
  }

  const results: { id: number; saved_at: string | null }[] = [];
  for (const { id, grade, comment } of updates) {
    const raw = grade.trim();
    const commentTrim = comment == null ? null : comment.trim();
    const finalComment = commentTrim === "" ? null : commentTrim;

    if (inResolutionPhase) {
      // Resolution phase saves into separate final_* columns so the
      // marker's original primary grade, comment and timestamp are
      // preserved for the audit trail.
      if (raw === "") {
        await query(
          `UPDATE submissions
           SET final_grade = NULL,
               final_comment = $1,
               final_graded_at = NULL
           WHERE id = $2`,
          [finalComment, id],
        );
        results.push({ id, saved_at: null });
      } else {
        const r = await queryOne<{ final_graded_at: string }>(
          `UPDATE submissions
           SET final_grade = $1,
               final_comment = $2,
               final_graded_at = now()
           WHERE id = $3 RETURNING final_graded_at`,
          [raw, finalComment, id],
        );
        results.push({ id, saved_at: r?.final_graded_at ?? null });
      }
    } else if (isPrimary) {
      if (raw === "") {
        await query(
          "UPDATE submissions SET grade = NULL, graded_at = NULL, primary_comment = $2 WHERE id = $1",
          [id, finalComment],
        );
        results.push({ id, saved_at: null });
      } else {
        const r = await queryOne<{ graded_at: string }>(
          `UPDATE submissions
           SET grade = $1, graded_at = now(), primary_comment = $2
           WHERE id = $3 RETURNING graded_at`,
          [raw, finalComment, id],
        );
        results.push({ id, saved_at: r?.graded_at ?? null });
      }
    } else {
      if (raw === "") {
        await query(
          "UPDATE submissions SET secondary_grade = NULL, secondary_graded_at = NULL, secondary_comment = $2 WHERE id = $1",
          [id, finalComment],
        );
        results.push({ id, saved_at: null });
      } else {
        const r = await queryOne<{ secondary_graded_at: string }>(
          `UPDATE submissions
           SET secondary_grade = $1, secondary_graded_at = now(), secondary_comment = $2
           WHERE id = $3 RETURNING secondary_graded_at`,
          [raw, finalComment, id],
        );
        results.push({ id, saved_at: r?.secondary_graded_at ?? null });
      }
    }
  }

  revalidatePath(`/m/${examId}/${token}`);
  return results;
}

export async function setGradeBySeatByTokenAction(
  examId: number,
  token: string,
  formData: FormData,
) {
  const { exam, role } = await authorize(examId, token);
  if (!isInMarkerPhase(role, exam.status)) {
    throw new Error("Marking is not currently open for you on this exam");
  }
  const seat = String(formData.get("seat") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  if (!seat) return;
  if (!isValidGrade(grade)) {
    throw new Error(
      "Grade must be a number with at most one decimal place",
    );
  }

  const row = await queryOne<{ id: number; in_sample: boolean }>(
    "SELECT id, in_sample FROM submissions WHERE exam_id = $1 AND seat_number = $2",
    [examId, seat],
  );
  if (!row) throw new Error(`Seat ${seat} not found for this exam`);
  if (role === "secondary" && !row.in_sample) {
    throw new Error(`Seat ${seat} is not in the second-marking sample`);
  }

  await saveGradesByTokenAction(examId, token, [
    { id: row.id, grade, comment },
  ]);
}

// Primary marker finishes first-pass marking.
// Server picks the initial sample using the exam's sampling_mode, sets status
// to first_marking_review so the admin can adjust the sample before the
// second marker is notified.
export async function completePrimaryMarkingByTokenAction(
  examId: number,
  token: string,
) {
  const { exam, role } = await authorize(examId, token);
  if (role !== "primary") throw new Error("Primary marker only");
  if (!isPrimaryMarkingPhase(exam.status)) {
    throw new Error("Primary marking is not currently in progress");
  }

  const subs = await query<{ id: number; grade: string | null }>(
    "SELECT id, grade FROM submissions WHERE exam_id = $1 ORDER BY id",
    [examId],
  );
  const ungraded = subs.filter((s) => s.grade == null).length;
  if (ungraded > 0) {
    throw new Error(`${ungraded} seat(s) still need a grade before completion`);
  }

  const sampleIds = computeSampleIdsForMode(subs, exam.sampling_mode);
  await query("UPDATE submissions SET in_sample = false WHERE exam_id = $1", [
    examId,
  ]);
  if (sampleIds.length > 0) {
    await query(
      "UPDATE submissions SET in_sample = true WHERE id = ANY($1::int[])",
      [sampleIds],
    );
  }

  await query(
    `UPDATE exams
     SET status = 'first_marking_review', primary_completed_at = now()
     WHERE id = $1`,
    [examId],
  );

  revalidatePath(`/m/${examId}/${token}`);
  revalidatePath(`/admin/exams/${examId}`);
}

// Secondary marker finishes second-pass marking.
// Computes final grades using exact-match rule. If any sampled row has a
// mismatch, status moves to 'review' so the primary marker can resolve.
export async function completeSecondaryMarkingByTokenAction(
  examId: number,
  token: string,
) {
  const { exam, role } = await authorize(examId, token);
  if (role !== "secondary") throw new Error("Secondary marker only");
  if (!isSecondaryMarkingPhase(exam.status)) {
    throw new Error("Secondary marking is not currently in progress");
  }

  const ungraded = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM submissions
     WHERE exam_id = $1 AND in_sample = true AND secondary_grade IS NULL`,
    [examId],
  );
  if (ungraded && ungraded.n > 0) {
    throw new Error(
      `${ungraded.n} sampled seat(s) still need a second-marker grade`,
    );
  }

  const subs = await query<{
    id: number;
    grade: string | null;
    secondary_grade: string | null;
    in_sample: boolean;
  }>(
    `SELECT id, grade, secondary_grade, in_sample FROM submissions
     WHERE exam_id = $1`,
    [examId],
  );
  let unresolved = 0;
  for (const s of subs) {
    const { value } = computeFinalGrade(s.grade, s.secondary_grade, s.in_sample);
    if (value === null) unresolved++;
    await query("UPDATE submissions SET final_grade = $1 WHERE id = $2", [
      value,
      s.id,
    ]);
  }

  await query(
    `UPDATE exams
     SET status = $1, secondary_completed_at = now()
     WHERE id = $2`,
    [unresolved > 0 ? "review" : "complete", examId],
  );

  revalidatePath(`/m/${examId}/${token}`);
  revalidatePath(`/admin/exams/${examId}`);
}

// Primary marker confirms they've resolved all discrepancies. Flips status
// back to 'complete' so the Canvas CSV can be downloaded.
export async function completeFinalMarkingByTokenAction(
  examId: number,
  token: string,
) {
  const { exam, role } = await authorize(examId, token);
  if (role !== "primary") throw new Error("Primary marker only");
  if (exam.status !== "review") {
    throw new Error("Final marking is not currently in progress");
  }
  const remaining = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1 AND final_grade IS NULL",
    [examId],
  );
  if ((remaining?.n ?? 0) > 0) {
    throw new Error(
      `${remaining?.n} seat(s) still need a final grade`,
    );
  }
  await query("UPDATE exams SET status = 'complete' WHERE id = $1", [examId]);
  revalidatePath(`/m/${examId}/${token}`);
  revalidatePath(`/admin/exams/${examId}`);
}
