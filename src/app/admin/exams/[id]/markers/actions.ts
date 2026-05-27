"use server";

import { revalidatePath } from "next/cache";
import {
  createMagicLinkToken,
  findOrCreateUser,
  getAppUrl,
  getCurrentUser,
} from "@/lib/auth";
import { query, queryOne, type Exam } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";

async function assertAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Admin only");
  }
}

export async function allocateMarkerAction(
  examId: number,
  formData: FormData,
) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid email address");
  }

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");

  const user = await findOrCreateUser(email, name);

  await query(
    `INSERT INTO exam_markers (exam_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [examId, user.id],
  );

  // Auto-email a magic link so the marker can sign in straight away.
  const token = await createMagicLinkToken(user.id);
  const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(`/marker/exams/${examId}`)}`;

  try {
    await sendMagicLinkEmail(user.email, link, { examName: exam.name });
  } catch (err) {
    console.error("Failed to send marker invitation", err);
  }

  revalidatePath(`/admin/exams/${examId}/markers`);
}

export async function resendInviteAction(examId: number, userId: number) {
  await assertAdmin();
  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) throw new Error("Exam not found");

  const user = await queryOne<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE id = $1",
    [userId],
  );
  if (!user) throw new Error("User not found");

  const token = await createMagicLinkToken(user.id);
  const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(`/marker/exams/${examId}`)}`;
  try {
    await sendMagicLinkEmail(user.email, link, { examName: exam.name });
  } catch (err) {
    console.error("Failed to resend invitation", err);
  }
  revalidatePath(`/admin/exams/${examId}/markers`);
}

export async function removeMarkerAction(examId: number, userId: number) {
  await assertAdmin();
  await query(
    "DELETE FROM exam_markers WHERE exam_id = $1 AND user_id = $2",
    [examId, userId],
  );
  revalidatePath(`/admin/exams/${examId}/markers`);
}
