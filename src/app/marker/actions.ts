"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";

export async function setGradeAction(
  examId: number,
  submissionId: number,
  formData: FormData,
) {
  const raw = String(formData.get("grade") ?? "").trim();
  if (raw === "") {
    await query(
      "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = $1 AND exam_id = $2",
      [submissionId, examId],
    );
  } else {
    await query(
      "UPDATE submissions SET grade = $1, graded_at = now() WHERE id = $2 AND exam_id = $3",
      [raw, submissionId, examId],
    );
  }
  revalidatePath(`/marker/exams/${examId}`);
}

export async function setGradeBySeatAction(
  examId: number,
  formData: FormData,
) {
  const seat = String(formData.get("seat") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  if (!seat) return;

  const row = await queryOne<{ id: number }>(
    "SELECT id FROM submissions WHERE exam_id = $1 AND seat_number = $2",
    [examId, seat],
  );
  if (!row) {
    throw new Error(`Seat ${seat} not found for this exam`);
  }

  if (grade === "") {
    await query(
      "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = $1",
      [row.id],
    );
  } else {
    await query(
      "UPDATE submissions SET grade = $1, graded_at = now() WHERE id = $2",
      [grade, row.id],
    );
  }
  revalidatePath(`/marker/exams/${examId}`);
}
