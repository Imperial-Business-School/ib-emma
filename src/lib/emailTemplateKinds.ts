// Metadata about the emails the app sends. Kept separate from the
// wording (which lives in emailDefaults.ts) so the UI can render the
// placeholder reference without importing runtime strings.

export const EMAIL_TEMPLATE_KINDS = [
  "first_commence",
  "second_commence",
  "first_overdue",
  "second_overdue",
  "first_late",
  "second_late",
  "first_marker_review",
  "admin_check_required",
  "exam_complete",
] as const;

export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export function isEmailTemplateKind(v: string): v is EmailTemplateKind {
  return (EMAIL_TEMPLATE_KINDS as readonly string[]).includes(v);
}

export const KIND_DESCRIPTIONS: Record<EmailTemplateKind, string> = {
  first_commence:
    "Sent to the first marker when the admin clicks Start first marking.",
  second_commence:
    "Sent to the second marker when the admin clicks Start Second Marking.",
  first_overdue:
    "Sent to the first marker when their deadline has passed but marking is not complete (< 5 working days late).",
  second_overdue:
    "Sent to the second marker when their deadline has passed (< 5 working days late).",
  first_late:
    "Sent to the first marker when their marking is 5+ working days overdue. Exam manager is normally CC'd.",
  second_late:
    "Sent to the second marker when their marking is 5+ working days overdue. Exam manager is normally CC'd.",
  first_marker_review:
    "Sent to the first marker when second marking completes with < 33.33% grade discrepancies. Second marker is normally CC'd.",
  admin_check_required:
    "Sent to admins when second marking completes with ≥ 33.33% grade discrepancies. First admin in To, others in CC.",
  exam_complete:
    "Sent to admins when an exam reaches Ready for Canvas upload. First admin in To, others in CC.",
};

// Placeholders usable in subject + body for each kind. Unknown or
// out-of-context placeholders (e.g. {differed} in first_commence) render
// as empty strings rather than being flagged as errors.
export const PLACEHOLDERS: Record<EmailTemplateKind, readonly string[]> = {
  first_commence: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  second_commence: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  first_overdue: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  second_overdue: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  first_late: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  second_late: [
    "marker_name",
    "role",
    "exam_name",
    "module_name",
    "module_code",
    "deadline",
    "link",
    "support_email",
  ],
  first_marker_review: [
    "marker_name",
    "exam_name",
    "module_name",
    "module_code",
    "differed",
    "total",
    "link",
    "support_email",
  ],
  admin_check_required: [
    "exam_name",
    "module_name",
    "module_code",
    "differed",
    "total",
    "link",
    "support_email",
  ],
  exam_complete: [
    "exam_name",
    "module_name",
    "module_code",
    "link",
    "support_email",
  ],
};

// CC-only tokens. In addition to these, admins can put literal email
// addresses in the CC field, comma-separated. Unknown tokens are
// dropped silently.
export const CC_PLACEHOLDERS: Record<EmailTemplateKind, readonly string[]> = {
  first_commence: [],
  second_commence: [],
  first_overdue: [],
  second_overdue: [],
  first_late: [],
  second_late: [],
  first_marker_review: ["second_marker"],
  admin_check_required: ["other_admins"],
  exam_complete: ["other_admins"],
};

export const PLACEHOLDER_HINTS: Record<string, string> = {
  marker_name: "The recipient marker's name.",
  role: 'The marker\'s role — "first" or "second".',
  exam_name: "The exam's name.",
  module_name: "The module's full name.",
  module_code: "The module's short code (e.g. BUSI70001).",
  deadline: "The marker's marking deadline, formatted DD/MM/YYYY.",
  link: "URL back to the marker's marking screen (or admin exam page for admin emails).",
  support_email: "The Exams team support address (bs-exams-team@imperial.ac.uk).",
  differed: "Number of sampled seats where the two markers disagreed.",
  total: "Total sampled non-absent seats with both markers' grades set.",
  second_marker: "CC-only: expands to the second marker's email address.",
  other_admins:
    "CC-only: expands to every admin except the To recipient, comma-separated.",
};
