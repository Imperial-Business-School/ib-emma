"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseCsv } from "@/lib/csv";

async function assertAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Admin only");
  }
}

export async function createExamAction(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!name) return;

  const row = await queryOne<{ id: number }>(
    "INSERT INTO exams (name, code) VALUES ($1, $2) RETURNING id",
    [name, code],
  );
  if (!row) throw new Error("Failed to create exam");

  redirect(`/admin/exams/${row.id}`);
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
