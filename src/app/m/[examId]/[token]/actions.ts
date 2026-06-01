"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, type Exam } from "@/lib/db";
import { computeFinalGrade } from "@/lib/finalGrade";
import { computeSampleIds } from "@/lib/sampling";

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

function expectedMarkerStatusFor(role: MarkerRole): Exam["status"] {
  return role === "primary" ? "primary_marking" : "secondary_marking";
}

export async function setGradeBySeatByTokenAction(
  examId: number,
  token: string,
  formData: FormData,
) {
  const { exam, role } = await authorize(examId, token);
  if (exam.status !== expectedMarkerStatusFor(role)) {
    throw new Error("Marking is not currently open for you on this exam");
  }
  const seat = String(formData.get("seat") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  if (!seat) return;

  const row = await queryOne<{ id: number; in_sample: boolean }>(
    "SELECT id, in_sample FROM submissions WHERE exam_id = $1 AND seat_number = $2",
    [examId, seat],
  );
  if (!row) throw new Error(`Seat ${seat} not found for this exam`);
  if (role === "secondary" && !row.in_sample) {
    throw new Error(`Seat ${seat} is not in the second-marking sample`);
  }

  await writeGrade(role, row.id, grade);
  revalidatePath(`/m/${examId}/${token}`);
}

export async function setGradeByTokenAction(
  examId: number,
  token: string,
  submissionId: number,
  formData: FormData,
) {
  const { exam, role } = await authorize(examId, token);
  if (exam.status !== expectedMarkerStatusFor(role)) {
    throw new Error("Marking is not currently open for you on this exam");
  }

  const sub = await queryOne<{ id: number; in_sample: boolean }>(
    "SELECT id, in_sample FROM submissions WHERE id = $1 AND exam_id = $2",
    [submissionId, examId],
  );
  if (!sub) throw new Error("Submission not found");
  if (role === "secondary" && !sub.in_sample) {
    throw new Error("That seat is not in the second-marking sample");
  }

  const raw = String(formData.get("grade") ?? "").trim();
  await writeGrade(role, sub.id, raw);
  revalidatePath(`/m/${examId}/${token}`);
}

// Bulk save: client component sends every (id, grade) it wants to update in
// one call. Returns the new DB timestamp per row so the client can show
// "Saved at HH:MM:SS".
export async function saveGradesByTokenAction(
  examId: number,
  token: string,
  updates: { id: number; grade: string }[],
): Promise<{ id: number; saved_at: string | null }[]> {
  const { exam, role } = await authorize(examId, token);
  if (exam.status !== expectedMarkerStatusFor(role)) {
    throw new Error("Marking is not currently open for you on this exam");
  }

  // Validate that every submitted row belongs to this exam, and that
  // secondary marker only touches sampled seats.
  const ids = updates.map((u) => u.id);
  if (ids.length === 0) return [];
  const rows = await query<{ id: number; in_sample: boolean }>(
    `SELECT id, in_sample FROM submissions
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
  }

  const results: { id: number; saved_at: string | null }[] = [];
  for (const { id, grade } of updates) {
    const raw = grade.trim();
    if (role === "primary") {
      if (raw === "") {
        await query(
          "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = $1",
          [id],
        );
        results.push({ id, saved_at: null });
      } else {
        const r = await queryOne<{ graded_at: string }>(
          "UPDATE submissions SET grade = $1, graded_at = now() WHERE id = $2 RETURNING graded_at",
          [raw, id],
        );
        results.push({ id, saved_at: r?.graded_at ?? null });
      }
    } else {
      if (raw === "") {
        await query(
          "UPDATE submissions SET secondary_grade = NULL, secondary_graded_at = NULL WHERE id = $1",
          [id],
        );
        results.push({ id, saved_at: null });
      } else {
        const r = await queryOne<{ secondary_graded_at: string }>(
          "UPDATE submissions SET secondary_grade = $1, secondary_graded_at = now() WHERE id = $2 RETURNING secondary_graded_at",
          [raw, id],
        );
        results.push({ id, saved_at: r?.secondary_graded_at ?? null });
      }
    }
  }

  revalidatePath(`/m/${examId}/${token}`);
  return results;
}

async function writeGrade(
  role: MarkerRole,
  submissionId: number,
  raw: string,
): Promise<void> {
  if (role === "primary") {
    if (raw === "") {
      await query(
        "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = $1",
        [submissionId],
      );
    } else {
      await query(
        "UPDATE submissions SET grade = $1, graded_at = now() WHERE id = $2",
        [raw, submissionId],
      );
    }
  } else {
    if (raw === "") {
      await query(
        "UPDATE submissions SET secondary_grade = NULL, secondary_graded_at = NULL WHERE id = $1",
        [submissionId],
      );
    } else {
      await query(
        "UPDATE submissions SET secondary_grade = $1, secondary_graded_at = now() WHERE id = $2",
        [raw, submissionId],
      );
    }
  }
}

export async function completePrimaryMarkingByTokenAction(
  examId: number,
  token: string,
) {
  const { exam, role } = await authorize(examId, token);
  if (role !== "primary") throw new Error("Primary marker only");
  if (exam.status !== "primary_marking") {
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

  const sampleIds = computeSampleIds(subs);
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
     SET status = 'secondary_marking', primary_completed_at = now()
     WHERE id = $1`,
    [examId],
  );

  revalidatePath(`/m/${examId}/${token}`);
  revalidatePath(`/admin/exams/${examId}`);
}

export async function completeSecondaryMarkingByTokenAction(
  examId: number,
  token: string,
) {
  const { exam, role } = await authorize(examId, token);
  if (role !== "secondary") throw new Error("Secondary marker only");
  if (exam.status !== "secondary_marking") {
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

  // Compute final grades. Non-sampled seats inherit the primary grade.
  // Sampled seats with both grades and |diff| <= 5 get the average; larger
  // discrepancies or non-numeric values are left null for admin to resolve.
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
