import { query, queryOne, type Exam } from "./db";
import { recordEmail, markerUrl } from "./deadlines";
import { getRequestOrigin } from "./origin";

// Emails sent when the second marker submits and the app decides
// where to route the exam next -- either to the first marker for
// discrepancy resolution, or to every admin when the discrepancy
// rate is high enough to need admin attention. Both use the wording
// dictated by the exam admins; both are recorded via the shared
// email_log plumbing so they show up in the admin email log alongside
// commence/overdue notifications.

type EmailContext = {
  examId: number;
  differed: number;
  total: number;
};

async function loadExamContext(examId: number): Promise<{
  exam: Exam;
  moduleName: string;
  moduleCode: string;
} | null> {
  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) return null;
  return {
    exam,
    moduleName: exam.module_name ?? exam.name,
    moduleCode: exam.code ?? "",
  };
}

export async function notifyFirstMarkerOfDiscrepancies({
  examId,
  differed,
  total,
}: EmailContext): Promise<void> {
  const ctx = await loadExamContext(examId);
  if (!ctx) return;
  const { exam, moduleName, moduleCode } = ctx;

  if (!exam.primary_marker_id) return;
  const marker = await queryOne<{ email: string; name: string | null }>(
    "SELECT email, name FROM users WHERE id = $1",
    [exam.primary_marker_id],
  );
  if (!marker) return;

  // CC the second marker so they can see the resolution being kicked
  // off. May be missing if the exam was created without a second
  // marker on file, in which case we just omit the cc.
  const secondMarker = exam.secondary_marker_id
    ? await queryOne<{ email: string }>(
        "SELECT email FROM users WHERE id = $1",
        [exam.secondary_marker_id],
      )
    : null;

  const origin = await getRequestOrigin();
  const link = markerUrl(origin, exam.id, exam.primary_access_token);
  const codeSuffix = moduleCode ? ` (${moduleCode})` : "";
  const subject = `Exam marking: please resolve grade discrepancies [${moduleName}, ${exam.name}]`;
  const body = [
    marker.name ? `Hi ${marker.name},` : "Hi,",
    "",
    `The second marker has completed their marking of ${exam.name} in ${moduleName}${codeSuffix}. ${differed} of ${total} grades differed from the grades you provided. Please check their grades and comments, then provide a final grade using this link: ${link}.`,
    "",
    "Thank you,",
    "Exam administration",
  ].join("\n");

  await recordEmail({
    to: marker.email,
    cc: secondMarker?.email,
    subject,
    body,
    examId: exam.id,
    kind: "first_marker_review",
  });
}

// Fired whenever an exam transitions into 'complete': either the
// first marker submits Final Marks, the second marker submits with
// no discrepancies, or an admin fills in the last final grade on an
// admin_check_required / review exam. One email per admin, so the
// Exams team knows the grades are ready to upload to Canvas.
export async function notifyAdminsOfExamComplete(
  examId: number,
): Promise<void> {
  const ctx = await loadExamContext(examId);
  if (!ctx) return;
  const { exam, moduleName, moduleCode } = ctx;

  const admins = await query<{ email: string; name: string }>(
    "SELECT email, name FROM admins ORDER BY lower(name)",
  );
  if (admins.length === 0) return;

  const origin = await getRequestOrigin();
  const link = `${origin}/admin/exams/${exam.id}`;
  const codeSuffix = moduleCode ? ` (${moduleCode})` : "";
  const subject = `Exam marking completed for ${exam.name} on ${moduleName}${codeSuffix}`;

  for (const admin of admins) {
    const body = [
      admin.name ? `Hello ${admin.name},` : "Hello,",
      "",
      "The first and second markers have completed marking for this exam. Please carry out final checks, download the final grades spreadsheet, and upload grades to Canvas.",
      "",
      `Link to exam admin page: ${link}`,
      "",
      "Thank you,",
      "Exam administration",
    ].join("\n");

    await recordEmail({
      to: admin.email,
      subject,
      body,
      examId: exam.id,
      kind: "exam_complete",
    });
  }
}

export async function notifyAdminsOfCheckRequired({
  examId,
  differed,
  total,
}: EmailContext): Promise<void> {
  const ctx = await loadExamContext(examId);
  if (!ctx) return;
  const { exam, moduleName, moduleCode } = ctx;

  const admins = await query<{ email: string; name: string }>(
    "SELECT email, name FROM admins ORDER BY lower(name)",
  );
  if (admins.length === 0) return;

  const origin = await getRequestOrigin();
  const link = `${origin}/admin/exams/${exam.id}`;
  const codeSuffix = moduleCode ? ` (${moduleCode})` : "";
  const codeSubject = moduleCode ? `, ${moduleCode}` : "";
  const subject = `Exam marking: grade discrepancies - admin check required (${moduleName}${codeSubject}, ${exam.name})`;

  for (const admin of admins) {
    const body = [
      admin.name ? `Hi ${admin.name},` : "Hi,",
      "",
      `Second marking is complete on ${exam.name} on ${moduleName}${codeSuffix}.`,
      "",
      `${differed} of ${total} grades differ between first and second marker. Please review the exam grades and discuss with both markers.`,
      "",
      link,
      "",
      "Thank you,",
      "Exam administration",
    ].join("\n");

    await recordEmail({
      to: admin.email,
      subject,
      body,
      examId: exam.id,
      kind: "admin_check_required",
      urgent: true,
    });
  }
}
