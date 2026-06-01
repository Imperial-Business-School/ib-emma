"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findOrCreateUser } from "@/lib/auth";
import { query, queryOne, randomToken, type Exam } from "@/lib/db";
import { parseCsv } from "@/lib/csv";

function parseEmail(input: FormDataEntryValue | null): string {
  const e = String(input ?? "").trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Please provide a valid email address");
  }
  return e;
}

export async function createExamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!name) throw new Error("Exam name is required");

  const primaryEmail = parseEmail(formData.get("primary_email"));
  const primaryName =
    String(formData.get("primary_name") ?? "").trim() || null;
  const secondaryEmail = parseEmail(formData.get("secondary_email"));
  const secondaryName =
    String(formData.get("secondary_name") ?? "").trim() || null;

  if (primaryEmail === secondaryEmail) {
    throw new Error("Primary and secondary markers must be different people");
  }

  const primary = await findOrCreateUser(primaryEmail, primaryName);
  const secondary = await findOrCreateUser(secondaryEmail, secondaryName);

  const row = await queryOne<{ id: number }>(
    `INSERT INTO exams
       (name, code, primary_marker_id, secondary_marker_id, status,
        primary_access_token, secondary_access_token)
     VALUES ($1, $2, $3, $4, 'setup', $5, $6)
     RETURNING id`,
    [name, code, primary.id, secondary.id, randomToken(), randomToken()],
  );
  if (!row) throw new Error("Failed to create exam");

  redirect(`/admin/exams/${row.id}`);
}

export async function reassignMarkerAction(
  examId: number,
  role: "primary" | "secondary",
  formData: FormData,
) {
  const email = parseEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim() || null;

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");

  const user = await findOrCreateUser(email, name);

  if (role === "primary" && user.id === exam.secondary_marker_id) {
    throw new Error("Primary and secondary markers must be different people");
  }
  if (role === "secondary" && user.id === exam.primary_marker_id) {
    throw new Error("Primary and secondary markers must be different people");
  }

  const column =
    role === "primary" ? "primary_marker_id" : "secondary_marker_id";
  await query(`UPDATE exams SET ${column} = $1 WHERE id = $2`, [
    user.id,
    examId,
  ]);

  revalidatePath(`/admin/exams/${examId}`);
}

export async function uploadSeatsAction(examId: number, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file uploaded");
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV is empty");

  let start = 0;
  const first = rows[0].map((s) => s.trim().toLowerCase());
  if (first.some((c) => /seat|cid|student/i.test(c))) start = 1;

  const entries: { seat: string; cid: string }[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const seat = (r[0] ?? "").trim();
    const cid = (r[1] ?? "").trim();
    if (!seat || !cid) continue;
    entries.push({ seat, cid });
  }
  if (entries.length === 0) throw new Error("No valid seat/CID rows found");

  for (const { seat, cid } of entries) {
    await query(
      `INSERT INTO submissions (exam_id, seat_number, cid)
       VALUES ($1, $2, $3)
       ON CONFLICT (exam_id, seat_number)
       DO UPDATE SET cid = EXCLUDED.cid`,
      [examId, seat, cid],
    );
  }

  revalidatePath(`/admin/exams/${examId}`);
}

export async function addSeatAction(examId: number, formData: FormData) {
  const seat = String(formData.get("seat") ?? "").trim();
  const cid = String(formData.get("cid") ?? "").trim();
  if (!seat || !cid) return;

  await query(
    `INSERT INTO submissions (exam_id, seat_number, cid)
     VALUES ($1, $2, $3)
     ON CONFLICT (exam_id, seat_number)
     DO UPDATE SET cid = EXCLUDED.cid`,
    [examId, seat, cid],
  );

  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteSeatAction(examId: number, submissionId: number) {
  await query("DELETE FROM submissions WHERE id = $1 AND exam_id = $2", [
    submissionId,
    examId,
  ]);
  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteExamAction(examId: number) {
  await query("DELETE FROM exams WHERE id = $1", [examId]);
  redirect("/admin");
}

export async function startPrimaryMarkingAction(examId: number) {

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");
  if (exam.status !== "setup") {
    throw new Error("Marking has already started for this exam");
  }
  if (!exam.primary_marker_id) {
    throw new Error("Primary marker is not set");
  }

  const seats = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1",
    [examId],
  );
  if (!seats || seats.n === 0) {
    throw new Error("Upload seat numbers before starting marking");
  }

  await query(
    "UPDATE exams SET status = 'primary_marking' WHERE id = $1",
    [examId],
  );

  revalidatePath(`/admin/exams/${examId}`);
}

export async function regenerateMarkerTokenAction(
  examId: number,
  role: "primary" | "secondary",
) {
  const column =
    role === "primary" ? "primary_access_token" : "secondary_access_token";
  await query(`UPDATE exams SET ${column} = $1 WHERE id = $2`, [
    randomToken(),
    examId,
  ]);
  revalidatePath(`/admin/exams/${examId}`);
}

export async function setFinalGradeAction(
  examId: number,
  submissionId: number,
  formData: FormData,
) {
  const raw = String(formData.get("final_grade") ?? "").trim();
  if (raw === "") {
    await query(
      "UPDATE submissions SET final_grade = NULL WHERE id = $1 AND exam_id = $2",
      [submissionId, examId],
    );
  } else {
    await query(
      "UPDATE submissions SET final_grade = $1 WHERE id = $2 AND exam_id = $3",
      [raw, submissionId, examId],
    );
  }

  // If every submission for this exam now has a final grade, flip status to
  // 'complete'. Otherwise drop back to 'review' if it was previously complete.
  const remaining = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1 AND final_grade IS NULL",
    [examId],
  );
  const unresolved = remaining?.n ?? 0;
  await query(
    `UPDATE exams SET status = $1
     WHERE id = $2 AND status IN ('complete','review')`,
    [unresolved === 0 ? "complete" : "review", examId],
  );

  revalidatePath(`/admin/exams/${examId}`);
}
