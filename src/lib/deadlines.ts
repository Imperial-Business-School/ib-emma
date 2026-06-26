import { query, queryOne, type Exam } from "@/lib/db";
import {
  isPrimaryMarkingPhase,
  isSecondaryMarkingPhase,
  type ExamStatus,
} from "@/lib/examStatus";
import { formatDateTime } from "@/lib/datetime";

// Number of working days after the deadline before status flips from
// "overdue" to "late".
export const LATE_THRESHOLD_WORKING_DAYS = 5;

// England & Wales bank holidays from GOV.UK. Refresh annually.
// https://www.gov.uk/bank-holidays
const UK_BANK_HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01",
  "2025-04-18",
  "2025-04-21",
  "2025-05-05",
  "2025-05-26",
  "2025-08-25",
  "2025-12-25",
  "2025-12-26",
  // 2026
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-04",
  "2026-05-25",
  "2026-08-31",
  "2026-12-25",
  "2026-12-28",
  // 2027
  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-05-03",
  "2027-05-31",
  "2027-08-30",
  "2027-12-27",
  "2027-12-28",
  // 2028
  "2028-01-03",
  "2028-04-14",
  "2028-04-17",
  "2028-05-01",
  "2028-05-29",
  "2028-08-28",
  "2028-12-25",
  "2028-12-26",
]);

function toUtcDateOnly(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWorkingDay(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (UK_BANK_HOLIDAYS.has(ymd(d))) return false;
  return true;
}

// Number of working days (Mon-Fri excluding England & Wales bank holidays)
// that have fully elapsed since `deadline`. A weekday counts the moment its
// next-day boundary is reached.
export function workingDaysSinceDeadline(
  deadline: Date,
  now: Date = new Date(),
): number {
  if (now.getTime() <= deadline.getTime()) return 0;
  const dStart = toUtcDateOnly(deadline);
  const nStart = toUtcDateOnly(now);
  if (nStart.getTime() <= dStart.getTime()) return 0;
  let count = 0;
  const cursor = new Date(dStart);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor.getTime() < nStart.getTime()) {
    if (isWorkingDay(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// Records an outgoing email. For now we don't actually send (no SMTP yet),
// but every email is persisted to the email_log table so the admin can
// review and audit them. Console.log is kept so logs are also visible in
// Vercel function output during development.
//
// When SMTP is wired up, this is the single chokepoint to add the send
// call and flip delivery_status from 'stub' to 'sent' or 'failed'.
export type EmailToSend = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  urgent?: boolean;
  examId?: number | null;
  kind?: string | null;
};

export async function recordEmail(e: EmailToSend): Promise<void> {
  try {
    await query(
      `INSERT INTO email_log
         (recipient, cc, subject, body, urgent, exam_id, kind, delivery_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'stub')`,
      [
        e.to,
        e.cc ?? null,
        e.subject,
        e.body,
        !!e.urgent,
        e.examId ?? null,
        e.kind ?? null,
      ],
    );
  } catch (err) {
    console.error("Failed to persist email to email_log", err);
  }

  const lines = [
    "─".repeat(60),
    `[email stub] ${e.urgent ? "URGENT — " : ""}${e.subject}`,
    `to: ${e.to}${e.cc ? ` (cc ${e.cc})` : ""}`,
    "",
    e.body,
    "─".repeat(60),
  ];
  console.log(lines.join("\n"));
}

/** @deprecated Use recordEmail instead. */
export const logStubEmail = recordEmail;

// Build the textual content of a marker notification email. Used for both
// the "commence marking" and the "overdue" reminder paths.
export function buildMarkerEmail(opts: {
  kind: "commence" | "overdue" | "late";
  markerName: string | null;
  markerEmail: string;
  examName: string;
  examCode: string | null;
  role: "primary" | "secondary";
  deadline: Date | null;
  url: string;
  examId?: number;
}): EmailToSend {
  const examLabel = opts.examCode
    ? `${opts.examCode} — ${opts.examName}`
    : opts.examName;
  const greeting = opts.markerName ? `Hi ${opts.markerName},` : "Hi,";
  const deadlineLine = opts.deadline
    ? `Deadline: ${formatDateTime(opts.deadline)} (UK time)`
    : "Deadline: not set";
  const roleLabel = opts.role === "primary" ? "primary" : "second";

  if (opts.kind === "commence") {
    return {
      to: opts.markerEmail,
      subject: `Marking ready: ${examLabel}`,
      kind: `${opts.role}_commence`,
      examId: opts.examId ?? null,
      body: [
        greeting,
        "",
        `You have been assigned as the ${roleLabel} marker for ${examLabel}.`,
        deadlineLine,
        "",
        `Open the marking screen: ${opts.url}`,
        "",
        "Thank you,",
        "Exam administration",
      ].join("\n"),
    };
  }

  const urgent = true;
  const subject =
    opts.kind === "overdue"
      ? `URGENT: ${roleLabel === "primary" ? "First" : "Second"} marking overdue — ${examLabel}`
      : `URGENT: ${roleLabel === "primary" ? "First" : "Second"} marking late — ${examLabel}`;

  const cc = opts.kind === "late" ? "exam.manager@ic.ac.uk" : undefined;

  return {
    to: opts.markerEmail,
    cc,
    urgent,
    subject,
    kind: `${opts.role}_${opts.kind}`,
    examId: opts.examId ?? null,
    body: [
      greeting,
      "",
      `Your ${roleLabel} marking of ${examLabel} is past the deadline.`,
      deadlineLine,
      "",
      opts.kind === "late"
        ? "This marking is now at least five working days overdue. The exam manager has been copied on this reminder."
        : "Please submit your grades as soon as possible.",
      "",
      `Open the marking screen: ${opts.url}`,
      "",
      "Thank you,",
      "Exam administration",
    ].join("\n"),
  };
}

// Convert exam.primary_access_token / secondary_access_token into a full
// marker URL using the request origin. The caller passes the origin since
// it varies by deployment.
export function markerUrl(
  origin: string,
  examId: number,
  token: string | null,
): string {
  if (!token) return origin;
  return `${origin}/m/${examId}/${token}`;
}

// Sweep all exams that might transition into overdue/late, applying status
// updates and emitting (stubbed) reminder emails.
//
// The sweep is idempotent: it only sends a "first reminder" if no
// _overdue_notified_at exists; only sends the "late" reminder if no
// _late_notified_at exists.
export async function sweepDeadlineStatuses(opts: {
  origin: string;
  examId?: number;
}): Promise<void> {
  const filter = opts.examId
    ? "AND id = $1"
    : "";
  const params: unknown[] = opts.examId ? [opts.examId] : [];
  const exams = await query<Exam>(
    `SELECT * FROM exams
     WHERE status IN (
       'primary_marking',
       'first_marking_overdue',
       'first_marking_late',
       'secondary_marking',
       'second_marking_overdue',
       'second_marking_late'
     ) ${filter}`,
    params,
  );

  const now = new Date();
  for (const e of exams) {
    if (isPrimaryMarkingPhase(e.status)) {
      await handlePhase({
        exam: e,
        phase: "primary",
        deadline: e.primary_deadline ? new Date(e.primary_deadline) : null,
        markerId: e.primary_marker_id,
        token: e.primary_access_token,
        origin: opts.origin,
        now,
      });
    } else if (isSecondaryMarkingPhase(e.status)) {
      await handlePhase({
        exam: e,
        phase: "secondary",
        deadline: e.secondary_deadline ? new Date(e.secondary_deadline) : null,
        markerId: e.secondary_marker_id,
        token: e.secondary_access_token,
        origin: opts.origin,
        now,
      });
    }
  }
}

async function handlePhase(args: {
  exam: Exam;
  phase: "primary" | "secondary";
  deadline: Date | null;
  markerId: number | null;
  token: string | null;
  origin: string;
  now: Date;
}): Promise<void> {
  const { exam, phase, deadline, markerId, token, origin, now } = args;
  if (!deadline || !markerId) return; // No deadline set; never overdue.
  if (now.getTime() <= deadline.getTime()) return; // Still on time.

  const daysLate = workingDaysSinceDeadline(deadline, now);
  const isLate = daysLate >= LATE_THRESHOLD_WORKING_DAYS;

  const overdueStatus: ExamStatus =
    phase === "primary" ? "first_marking_overdue" : "second_marking_overdue";
  const lateStatus: ExamStatus =
    phase === "primary" ? "first_marking_late" : "second_marking_late";
  const targetStatus: ExamStatus = isLate ? lateStatus : overdueStatus;

  // No-op if nothing needs to change.
  const alreadyNotifiedOverdue =
    phase === "primary"
      ? exam.primary_overdue_notified_at != null
      : exam.secondary_overdue_notified_at != null;
  const alreadyNotifiedLate =
    phase === "primary"
      ? exam.primary_late_notified_at != null
      : exam.secondary_late_notified_at != null;

  if (
    exam.status === targetStatus &&
    (isLate ? alreadyNotifiedLate : alreadyNotifiedOverdue)
  ) {
    return;
  }

  // Load the marker details for the email.
  const marker = await queryOne<{
    email: string;
    name: string | null;
  }>("SELECT email, name FROM users WHERE id = $1", [markerId]);
  if (!marker) return;

  // Update status.
  if (exam.status !== targetStatus) {
    await query("UPDATE exams SET status = $1 WHERE id = $2", [
      targetStatus,
      exam.id,
    ]);
  }

  // Send + record reminder if needed.
  const url = markerUrl(origin, exam.id, token);
  if (!alreadyNotifiedOverdue) {
    await recordEmail(
      buildMarkerEmail({
        kind: "overdue",
        markerName: marker.name,
        markerEmail: marker.email,
        examName: exam.name,
        examCode: exam.code,
        role: phase,
        deadline,
        url,
        examId: exam.id,
      }),
    );
    const col =
      phase === "primary"
        ? "primary_overdue_notified_at"
        : "secondary_overdue_notified_at";
    await query(`UPDATE exams SET ${col} = now() WHERE id = $1`, [exam.id]);
  }
  if (isLate && !alreadyNotifiedLate) {
    await recordEmail(
      buildMarkerEmail({
        kind: "late",
        markerName: marker.name,
        markerEmail: marker.email,
        examName: exam.name,
        examCode: exam.code,
        role: phase,
        deadline,
        url,
        examId: exam.id,
      }),
    );
    const col =
      phase === "primary"
        ? "primary_late_notified_at"
        : "secondary_late_notified_at";
    await query(`UPDATE exams SET ${col} = now() WHERE id = $1`, [exam.id]);
  }
}
