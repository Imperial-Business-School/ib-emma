"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function setGradeAction(
  examId: number,
  submissionId: number,
  formData: FormData,
) {
  const raw = String(formData.get("grade") ?? "").trim();
  if (raw === "") {
    db.prepare(
      "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = ? AND exam_id = ?",
    ).run(submissionId, examId);
  } else {
    db.prepare(
      "UPDATE submissions SET grade = ?, graded_at = datetime('now') WHERE id = ? AND exam_id = ?",
    ).run(raw, submissionId, examId);
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

  const row = db
    .prepare(
      "SELECT id FROM submissions WHERE exam_id = ? AND seat_number = ?",
    )
    .get(examId, seat) as { id: number } | undefined;

  if (!row) {
    throw new Error(`Seat ${seat} not found for this exam`);
  }

  if (grade === "") {
    db.prepare(
      "UPDATE submissions SET grade = NULL, graded_at = NULL WHERE id = ?",
    ).run(row.id);
  } else {
    db.prepare(
      "UPDATE submissions SET grade = ?, graded_at = datetime('now') WHERE id = ?",
    ).run(grade, row.id);
  }
  revalidatePath(`/marker/exams/${examId}`);
}
