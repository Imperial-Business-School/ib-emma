"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createMagicLinkToken,
  findOrCreateUser,
  getAppUrl,
  getCurrentUser,
} from "@/lib/auth";
import { query, queryOne, type Exam } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { sendMagicLinkEmail } from "@/lib/email";

async function assertAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Admin only");
  }
}

function parseEmail(input: FormDataEntryValue | null): string {
  const e = String(input ?? "").trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Please provide a valid email address");
  }
  return e;
}

export async function createExamAction(formData: FormData) {
  await assertAdmin();
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
    `INSERT INTO exams (name, code, primary_marker_id, secondary_marker_id, status)
     VALUES ($1, $2, $3, $4, 'setup')
     RETURNING id`,
    [name, code, primary.id, secondary.id],
  );
  if (!row) throw new Error("Failed to create exam");

  redirect(`/admin/exams/${row.id}`);
}

export async function reassignMarkerAction(
  examId: number,
  role: "primary" | "secondary",
  formData: FormData,
) {
  await assertAdmin();
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
  await assertAdmin();
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
  await assertAdmin();
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
  await assertAdmin();
  await query("DELETE FROM submissions WHERE id = $1 AND exam_id = $2", [
    submissionId,
    examId,
  ]);
  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteExamAction(examId: number) {
  await assertAdmin();
  await query("DELETE FROM exams WHERE id = $1", [examId]);
  redirect("/admin");
}

export async function startPrimaryMarkingAction(examId: number) {
  await assertAdmin();

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

  const primary = await queryOne<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE id = $1",
    [exam.primary_marker_id],
  );
  if (!primary) throw new Error("Primary marker not found");

  await query(
    "UPDATE exams SET status = 'primary_marking' WHERE id = $1",
    [examId],
  );

  const token = await createMagicLinkToken(primary.id);
  const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(`/marker/exams/${examId}`)}`;
  try {
    await sendMagicLinkEmail(primary.email, link, { examName: exam.name });
  } catch (err) {
    console.error("Failed to email primary marker", err);
  }

  revalidatePath(`/admin/exams/${examId}`);
}

export async function resolveReviewAction(examId: number) {
  await assertAdmin();
  await query(
    "UPDATE exams SET status = 'complete' WHERE id = $1 AND status = 'review'",
    [examId],
  );
  revalidatePath(`/admin/exams/${examId}`);
}
