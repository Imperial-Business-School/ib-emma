import type { EmailTemplateKind } from "./emailTemplateKinds";

// Default subject / body / CC / urgent for each email the app can send.
// These are the seed values inserted into email_templates on first run,
// AND the fallback if a row is missing at send time, AND what the
// "Reset to default" button restores.

export type EmailTemplateDefault = {
  subject: string;
  body: string;
  cc: string | null;
  urgent: boolean;
};

const COMMENCE_BODY = [
  "Hi {marker_name}",
  "",
  "You have been assigned as the {role} marker for {exam_name} on {module_name} ({module_code}).",
  "",
  "Deadline: 10:00 on {deadline} (UK time)",
  "",
  "Visit this link to submit marks: {link}",
  "",
  "The Exams team will provide you with the exam scripts or Wiseflow link separately.",
  "",
  "Thank you,",
  "",
  "Exams team",
  "Imperial Business School",
  "",
  "This is an automated notification sent by EMMS. Do not reply. Contact {support_email} for help.",
].join("\n");

const OVERDUE_BODY = [
  "Hi {marker_name}",
  "",
  "You have not completed marking the following exam and the deadline has passed:",
  "",
  "{exam_name} on {module_name} ({module_code})",
  "",
  "Deadline: 10:00 on {deadline} (UK time)",
  "",
  "Please submit your grades as soon as possible.",
  "",
  "If you need to discuss an extension to the marking deadline, or have any challenges in completing the marking, please get in touch with the Exams team at {support_email}.",
  "",
  "Visit this link to submit marks: {link}",
  "",
  "Thank you,",
  "",
  "Exams team",
  "Imperial Business School",
  "",
  "This is an automated notification sent by EMMS. Do not reply. Contact {support_email} for help.",
].join("\n");

const LATE_BODY = [
  "Hi {marker_name}",
  "",
  "You have not completed marking the following exam and the deadline has passed:",
  "",
  "{exam_name} on {module_name} ({module_code})",
  "",
  "Deadline: 10:00 on {deadline} (UK time)",
  "",
  "Marking is now at least five working days overdue. The exam manager has been copied on this reminder.",
  "",
  "Please submit your grades as soon as possible.",
  "",
  "If you need to discuss an extension to the marking deadline, or have any challenges in completing the marking, please get in touch with the Exams team at {support_email}.",
  "",
  "Visit this link to submit marks: {link}",
  "",
  "Thank you,",
  "",
  "Exams team",
  "Imperial Business School",
  "",
  "This is an automated notification sent by EMMS. Do not reply. Contact {support_email} for help.",
].join("\n");

const FIRST_MARKER_REVIEW_BODY = [
  "Hi {marker_name},",
  "",
  "The second marker has completed their marking of {exam_name} in {module_name} ({module_code}). {differed} of {total} grades differed from the grades you provided. Please check their grades and comments, then provide a final grade using this link: {link}.",
  "",
  "Thank you,",
  "Exam administration",
].join("\n");

const ADMIN_CHECK_REQUIRED_BODY = [
  "Hi,",
  "",
  "Second marking is complete on {exam_name} on {module_name} ({module_code}).",
  "",
  "{differed} of {total} grades differ between first and second marker. Please review the exam grades and discuss with both markers.",
  "",
  "{link}",
  "",
  "Thank you,",
  "Exam administration",
].join("\n");

const EXAM_COMPLETE_BODY = [
  "Hello,",
  "",
  "The first and second markers have completed marking for this exam. Please carry out final checks, download the final grades spreadsheet, and upload grades to Canvas.",
  "",
  "Link to exam admin page: {link}",
  "",
  "Thank you,",
  "Exam administration",
].join("\n");

export const DEFAULT_TEMPLATES: Record<EmailTemplateKind, EmailTemplateDefault> = {
  first_commence: {
    subject: "Exam marking: please begin marking {exam_name} for {module_name}",
    body: COMMENCE_BODY,
    cc: null,
    urgent: false,
  },
  second_commence: {
    subject: "Exam marking: please begin marking {exam_name} for {module_name}",
    body: COMMENCE_BODY,
    cc: null,
    urgent: false,
  },
  first_overdue: {
    subject: "URGENT: First marking overdue — {module_code} — {exam_name}",
    body: OVERDUE_BODY,
    cc: null,
    urgent: true,
  },
  second_overdue: {
    subject: "URGENT: Second marking overdue — {module_code} — {exam_name}",
    body: OVERDUE_BODY,
    cc: null,
    urgent: true,
  },
  first_late: {
    subject: "URGENT: First marking late — {module_code} — {exam_name}",
    body: LATE_BODY,
    cc: "exam.manager@ic.ac.uk",
    urgent: true,
  },
  second_late: {
    subject: "URGENT: Second marking late — {module_code} — {exam_name}",
    body: LATE_BODY,
    cc: "exam.manager@ic.ac.uk",
    urgent: true,
  },
  first_marker_review: {
    subject:
      "Exam marking: please resolve grade discrepancies [{module_name}, {exam_name}]",
    body: FIRST_MARKER_REVIEW_BODY,
    cc: "{second_marker}",
    urgent: false,
  },
  admin_check_required: {
    subject:
      "Exam marking: grade discrepancies - admin check required ({module_name}, {module_code}, {exam_name})",
    body: ADMIN_CHECK_REQUIRED_BODY,
    cc: "{other_admins}",
    urgent: true,
  },
  exam_complete: {
    subject: "Exam marking completed for {exam_name} on {module_name} ({module_code})",
    body: EXAM_COMPLETE_BODY,
    cc: "{other_admins}",
    urgent: false,
  },
};
