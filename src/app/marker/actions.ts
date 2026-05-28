"use server";

import { revalidatePath } from "next/cache";
import {
  createMagicLinkToken,
  getAppUrl,
  getCurrentUser,
  getMarkerRoleForExam,
  type MarkerRole,
} from "@/lib/auth";
import { query, queryOne, type Exam } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";
import { computeSampleIds } from "@/lib/sampling";

type AccessContext = {
  examId: number;
  exam: Exam;
  role: MarkerRole;
};

async function assertMarkerForExam(examId: number): Promise<AccessContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");
  if (user.role === "admin") {
    throw new Error(
      "Admins cannot enter marker grades — sign in as the assigned marker",
    );
  }
  const role = await getMarkerRoleForExam(user.id, examId);
  if (!role) throw new Error("Not allocated to this exam");
  return { examId, exam, role };
}

function expectedMarkerStatusFor(role: MarkerRole): Exam["status"] {
  return role === "primary" ? "primary_marking" : "secondary_marking";
}

export async function setGradeBySeatAction(
  examId: number,
  formData: FormData,
) {
  const ctx = await assertMarkerForExam(examId);
  if (ctx.exam.status !== expectedMarkerStatusFor(ctx.role)) {
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

  // Secondary marker may only grade sampled seats.
  if (ctx.role === "secondary" && !row.in_sample) {
    throw new Error(`Seat ${seat} is not in the second-marking sample`);
  }

  await writeGrade(ctx.role, row.id, grade);
  revalidatePath(`/marker/exams/${examId}`);
}

export async function setGradeAction(
  examId: number,
  submissionId: number,
  formData: FormData,
) {
  const ctx = await assertMarkerForExam(examId);
  if (ctx.exam.status !== expectedMarkerStatusFor(ctx.role)) {
    throw new Error("Marking is not currently open for you on this exam");
  }

  const sub = await queryOne<{ id: number; in_sample: boolean }>(
    "SELECT id, in_sample FROM submissions WHERE id = $1 AND exam_id = $2",
    [submissionId, examId],
  );
  if (!sub) throw new Error("Submission not found");
  if (ctx.role === "secondary" && !sub.in_sample) {
    throw new Error("That seat is not in the second-marking sample");
  }

  const raw = String(formData.get("grade") ?? "").trim();
  await writeGrade(ctx.role, sub.id, raw);
  revalidatePath(`/marker/exams/${examId}`);
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

export async function completePrimaryMarkingAction(examId: number) {
  const ctx = await assertMarkerForExam(examId);
  if (ctx.role !== "primary") throw new Error("Only the primary marker can do this");
  if (ctx.exam.status !== "primary_marking") {
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
  if (!ctx.exam.secondary_marker_id) {
    throw new Error("No secondary marker assigned");
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

  const secondary = await queryOne<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE id = $1",
    [ctx.exam.secondary_marker_id],
  );
  if (secondary) {
    const token = await createMagicLinkToken(secondary.id);
    const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(`/marker/exams/${examId}`)}`;
    try {
      await sendMagicLinkEmail(secondary.email, link, {
        examName: ctx.exam.name,
      });
    } catch (err) {
      console.error("Failed to email secondary marker", err);
    }
  }

  revalidatePath(`/marker/exams/${examId}`);
  revalidatePath(`/admin/exams/${examId}`);
}

export async function completeSecondaryMarkingAction(examId: number) {
  const ctx = await assertMarkerForExam(examId);
  if (ctx.role !== "secondary") {
    throw new Error("Only the secondary marker can do this");
  }
  if (ctx.exam.status !== "secondary_marking") {
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

  const disc = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM submissions
     WHERE exam_id = $1 AND in_sample = true
       AND grade IS DISTINCT FROM secondary_grade`,
    [examId],
  );
  const hasDiscrepancies = (disc?.n ?? 0) > 0;

  await query(
    `UPDATE exams
     SET status = $1, secondary_completed_at = now()
     WHERE id = $2`,
    [hasDiscrepancies ? "review" : "complete", examId],
  );

  revalidatePath(`/marker/exams/${examId}`);
  revalidatePath(`/admin/exams/${examId}`);
}
