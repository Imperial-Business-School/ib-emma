"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findOrCreateUser } from "@/lib/auth";
import { query, queryOne, randomToken, type Exam } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import {
  buildMarkerEmail,
  logStubEmail,
  markerUrl,
} from "@/lib/deadlines";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function parseDeadline(input: FormDataEntryValue | null): Date | null {
  const v = String(input ?? "").trim();
  if (!v) return null;
  // <input type="datetime-local"> sends "YYYY-MM-DDTHH:MM" without timezone.
  // Browsers interpret as local; we follow the same convention.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Deadline is not a valid date/time");
  }
  return d;
}

function parseEmail(input: FormDataEntryValue | null): string {
  const e = String(input ?? "").trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new Error("Please provide a valid email address");
  }
  return e;
}

function parseSamplingMode(v: FormDataEntryValue | null): "standard" | "full" {
  const s = String(v ?? "standard").trim();
  return s === "full" ? "full" : "standard";
}

export async function createExamAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;
  const samplingMode = parseSamplingMode(formData.get("sampling_mode"));
  const primaryDeadline = parseDeadline(formData.get("primary_deadline"));
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
        sampling_mode, primary_access_token, secondary_access_token,
        primary_deadline)
     VALUES ($1, $2, $3, $4, 'setup', $5, $6, $7, $8)
     RETURNING id`,
    [
      name,
      code,
      primary.id,
      secondary.id,
      samplingMode,
      randomToken(),
      randomToken(),
      primaryDeadline?.toISOString() ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create exam");

  redirect(`/admin/exams/${row.id}`);
}

export async function updatePrimaryDeadlineAction(
  examId: number,
  formData: FormData,
) {
  const deadline = parseDeadline(formData.get("primary_deadline"));
  await query(
    "UPDATE exams SET primary_deadline = $1 WHERE id = $2 AND status = 'setup'",
    [deadline?.toISOString() ?? null, examId],
  );
  revalidatePath(`/admin/exams/${examId}`);
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

export async function deleteExamAction(examId: number, formData: FormData) {
  const exam = await queryOne<Exam>("SELECT name FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) return;
  const typed = String(formData.get("confirm_name") ?? "").trim();
  if (typed !== exam.name) {
    throw new Error(
      `Type the exam name exactly to confirm deletion. Got "${typed}", expected "${exam.name}".`,
    );
  }
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

  // Stub email to the primary marker. Will go through real SMTP later.
  const marker = await queryOne<{ email: string; name: string | null }>(
    "SELECT email, name FROM users WHERE id = $1",
    [exam.primary_marker_id],
  );
  if (marker) {
    const origin = await getOrigin();
    logStubEmail(
      buildMarkerEmail({
        kind: "commence",
        markerName: marker.name,
        markerEmail: marker.email,
        examName: exam.name,
        examCode: exam.code,
        role: "primary",
        deadline: exam.primary_deadline ? new Date(exam.primary_deadline) : null,
        url: markerUrl(origin, exam.id, exam.primary_access_token),
      }),
    );
  }

  revalidatePath(`/admin/exams/${examId}`);
}

export async function toggleInSampleAction(
  examId: number,
  submissionId: number,
) {
  const exam = await queryOne<Exam>("SELECT status FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");
  if (exam.status !== "first_marking_review") {
    throw new Error(
      "Sample can only be adjusted while awaiting admin review of first marking",
    );
  }
  await query(
    "UPDATE submissions SET in_sample = NOT in_sample WHERE id = $1 AND exam_id = $2",
    [submissionId, examId],
  );
  revalidatePath(`/admin/exams/${examId}`);
}

export async function startSecondaryMarkingAction(
  examId: number,
  formData: FormData,
) {
  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");
  if (exam.status !== "first_marking_review") {
    throw new Error("Exam is not awaiting admin review");
  }
  const secondaryDeadline = parseDeadline(
    formData.get("secondary_deadline"),
  );
  if (!secondaryDeadline) {
    throw new Error(
      "Set a deadline for the second marker before starting second marking",
    );
  }
  const sample = await queryOne<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM submissions WHERE exam_id = $1 AND in_sample = true",
    [examId],
  );
  if (!sample || sample.n === 0) {
    throw new Error("Add at least one seat to the second-marking sample");
  }
  await query(
    `UPDATE exams
     SET status = 'secondary_marking',
         secondary_deadline = $1,
         secondary_overdue_notified_at = NULL,
         secondary_late_notified_at = NULL
     WHERE id = $2`,
    [secondaryDeadline.toISOString(), examId],
  );

  // Stub email to the second marker.
  if (exam.secondary_marker_id) {
    const marker = await queryOne<{ email: string; name: string | null }>(
      "SELECT email, name FROM users WHERE id = $1",
      [exam.secondary_marker_id],
    );
    if (marker) {
      const origin = await getOrigin();
      logStubEmail(
        buildMarkerEmail({
          kind: "commence",
          markerName: marker.name,
          markerEmail: marker.email,
          examName: exam.name,
          examCode: exam.code,
          role: "secondary",
          deadline: secondaryDeadline,
          url: markerUrl(origin, exam.id, exam.secondary_access_token),
        }),
      );
    }
  }

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
