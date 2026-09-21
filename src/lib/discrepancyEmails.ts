import { query, queryOne, type Exam } from "./db";
import { recordEmail, markerUrl } from "./deadlines";
import { getRequestOrigin } from "./origin";
import { getTemplate, renderCcList, renderTemplate } from "./emailTemplates";

// Emails sent when the second marker submits and the app decides where
// to route the exam next -- either to the first marker for discrepancy
// resolution, or to every admin when the discrepancy rate is high enough
// to need admin attention. Also the exam-complete fanout. Every message
// pulls its subject / body / cc from the admin-editable email_templates
// table via getTemplate, so wording changes ship without a redeploy.

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

const SUPPORT_EMAIL = "bs-exams-team@imperial.ac.uk";

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

  const secondMarker = exam.secondary_marker_id
    ? await queryOne<{ email: string }>(
        "SELECT email FROM users WHERE id = $1",
        [exam.secondary_marker_id],
      )
    : null;

  const origin = await getRequestOrigin();
  const template = await getTemplate("first_marker_review");
  const vars = {
    marker_name: marker.name ?? "there",
    exam_name: exam.name,
    module_name: moduleName,
    module_code: moduleCode,
    differed,
    total,
    link: markerUrl(origin, exam.id, exam.primary_access_token),
    support_email: SUPPORT_EMAIL,
  };
  const cc = renderCcList(template.cc, {
    secondMarkerEmail: secondMarker?.email ?? null,
  });

  await recordEmail({
    to: marker.email,
    cc,
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
    urgent: template.urgent,
    examId: exam.id,
    kind: "first_marker_review",
  });
}

// One-shot admin fanout used by both admin_check_required and
// exam_complete. First admin (alphabetical by name) lands in To; the
// rest are rolled into CC by the template's {other_admins} token.
async function fanoutToAdmins(params: {
  templateKind: "admin_check_required" | "exam_complete";
  examId: number;
  vars: Record<string, string | number | null | undefined>;
}): Promise<void> {
  const admins = await query<{ email: string; name: string }>(
    "SELECT email, name FROM admins ORDER BY lower(name)",
  );
  if (admins.length === 0) return;

  const template = await getTemplate(params.templateKind);
  const [primary, ...rest] = admins;
  const cc = renderCcList(template.cc, {
    otherAdminEmails: rest.map((a) => a.email),
  });

  await recordEmail({
    to: primary.email,
    cc,
    subject: renderTemplate(template.subject, params.vars),
    body: renderTemplate(template.body, params.vars),
    urgent: template.urgent,
    examId: params.examId,
    kind: params.templateKind,
  });
}

export async function notifyAdminsOfExamComplete(
  examId: number,
): Promise<void> {
  const ctx = await loadExamContext(examId);
  if (!ctx) return;
  const { exam, moduleName, moduleCode } = ctx;
  const origin = await getRequestOrigin();
  await fanoutToAdmins({
    templateKind: "exam_complete",
    examId,
    vars: {
      exam_name: exam.name,
      module_name: moduleName,
      module_code: moduleCode,
      link: `${origin}/admin/exams/${exam.id}`,
      support_email: SUPPORT_EMAIL,
    },
  });
}

export async function notifyAdminsOfCheckRequired({
  examId,
  differed,
  total,
}: EmailContext): Promise<void> {
  const ctx = await loadExamContext(examId);
  if (!ctx) return;
  const { exam, moduleName, moduleCode } = ctx;
  const origin = await getRequestOrigin();
  await fanoutToAdmins({
    templateKind: "admin_check_required",
    examId,
    vars: {
      exam_name: exam.name,
      module_name: moduleName,
      module_code: moduleCode,
      differed,
      total,
      link: `${origin}/admin/exams/${exam.id}`,
      support_email: SUPPORT_EMAIL,
    },
  });
}
