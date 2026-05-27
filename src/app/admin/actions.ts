"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";

export async function createExamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  if (!name) return;

  const result = db
    .prepare("INSERT INTO exams (name, code) VALUES (?, ?)")
    .run(name, code);

  redirect(`/admin/exams/${result.lastInsertRowid}`);
}

export async function uploadSeatsAction(examId: number, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file uploaded");
  }
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV is empty");

  // Detect header by looking at row 0
  let start = 0;
  const first = rows[0].map((s) => s.trim().toLowerCase());
  if (first.some((c) => /seat|cid|student/i.test(c))) start = 1;

  const insert = db.prepare(
    `INSERT INTO submissions (exam_id, seat_number, cid)
     VALUES (?, ?, ?)
     ON CONFLICT(exam_id, seat_number) DO UPDATE SET cid = excluded.cid`,
  );
  const tx = db.transaction((entries: { seat: string; cid: string }[]) => {
    for (const { seat, cid } of entries) insert.run(examId, seat, cid);
  });

  const entries: { seat: string; cid: string }[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const seat = (r[0] ?? "").trim();
    const cid = (r[1] ?? "").trim();
    if (!seat || !cid) continue;
    entries.push({ seat, cid });
  }
  if (entries.length === 0) throw new Error("No valid seat/CID rows found");
  tx(entries);

  revalidatePath(`/admin/exams/${examId}`);
}

export async function addSeatAction(examId: number, formData: FormData) {
  const seat = String(formData.get("seat") ?? "").trim();
  const cid = String(formData.get("cid") ?? "").trim();
  if (!seat || !cid) return;

  db.prepare(
    `INSERT INTO submissions (exam_id, seat_number, cid)
     VALUES (?, ?, ?)
     ON CONFLICT(exam_id, seat_number) DO UPDATE SET cid = excluded.cid`,
  ).run(examId, seat, cid);

  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteSeatAction(examId: number, submissionId: number) {
  db.prepare("DELETE FROM submissions WHERE id = ? AND exam_id = ?").run(
    submissionId,
    examId,
  );
  revalidatePath(`/admin/exams/${examId}`);
}

export async function deleteExamAction(examId: number) {
  db.prepare("DELETE FROM exams WHERE id = ?").run(examId);
  redirect("/admin");
}
