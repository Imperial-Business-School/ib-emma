import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/actor";
import { getAllTemplates } from "@/lib/emailTemplates";
import {
  EMAIL_TEMPLATE_KINDS,
  KIND_DESCRIPTIONS,
  PLACEHOLDERS,
  CC_PLACEHOLDERS,
} from "@/lib/emailTemplateKinds";
import { finaliseTemplateSheet } from "@/lib/xlsxTemplate";

export const dynamic = "force-dynamic";

// Downloadable bulk-edit template. Admins fill in Subject / Body /
// CC / Urgent, save, then upload it back via the same page. The Kind
// column is the primary key; do not change it.
export async function GET() {
  if (!(await adminAllowed())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rows = await getAllTemplates();
  const byKind = new Map(rows.map((r) => [r.kind, r]));

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Templates");
  sheet.columns = [
    { header: "Kind (do not change)", key: "kind", width: 24 },
    { header: "Description", key: "description", width: 40 },
    { header: "Subject", key: "subject", width: 60 },
    { header: "Body", key: "body", width: 80 },
    { header: "CC", key: "cc", width: 30 },
    { header: "Urgent (Y/N)", key: "urgent", width: 12 },
    { header: "Body placeholders", key: "vars", width: 40 },
    { header: "CC placeholders", key: "cc_vars", width: 30 },
  ];

  for (const kind of EMAIL_TEMPLATE_KINDS) {
    const row = byKind.get(kind);
    sheet.addRow({
      kind,
      description: KIND_DESCRIPTIONS[kind],
      subject: row?.subject ?? "",
      body: row?.body ?? "",
      cc: row?.cc ?? "",
      urgent: (row?.urgent ?? false) ? "Y" : "N",
      vars: PLACEHOLDERS[kind].map((p) => `{${p}}`).join(", "),
      cc_vars: CC_PLACEHOLDERS[kind].map((p) => `{${p}}`).join(", "),
    });
  }

  // Wrap the long text columns for readability on first open.
  for (const key of ["description", "subject", "body", "cc", "vars", "cc_vars"]) {
    const col = sheet.getColumn(key);
    col.alignment = { wrapText: true, vertical: "top" };
  }

  // Instructions sheet -- explains what each column is for, and lists
  // every placeholder available.
  const help = wb.addWorksheet("Instructions");
  help.columns = [
    { header: "Placeholder", key: "p", width: 22 },
    { header: "Where usable", key: "where", width: 20 },
    { header: "What it becomes", key: "what", width: 80 },
  ];
  const PLACEHOLDER_HINTS: Record<string, [string, string]> = {
    marker_name: ["Body/subject", "The recipient marker's name (falls back to \"there\")."],
    role: ["Body/subject", 'The marker\'s role, lowercase: "first" or "second".'],
    Role: ["Body/subject", 'The marker\'s role, capitalised: "First" or "Second".'],
    exam_name: ["Body/subject", "The exam name."],
    module_name: ["Body/subject", "The full module name."],
    module_code: ["Body/subject", "The module short code (e.g. BUSI70001)."],
    deadline: ["Body/subject", "The marker's marking deadline, formatted DD/MM/YYYY."],
    link: ["Body/subject", "URL back to the marker's screen (or the admin exam page for admin-audience emails)."],
    support_email: ["Body/subject", "bs-exams-team@imperial.ac.uk"],
    differed: ["Body/subject", "Number of sampled seats where the two markers disagreed."],
    total: ["Body/subject", "Total sampled non-absent seats with both markers' grades."],
    second_marker: ["CC only", "Expands to the second marker's email address."],
    other_admins: ["CC only", "Expands to every admin except the To recipient, comma-separated."],
  };
  for (const [p, [where, what]] of Object.entries(PLACEHOLDER_HINTS)) {
    help.addRow({ p: `{${p}}`, where, what });
  }
  help.addRow({});
  help.addRow({
    p: "Notes",
    where: "",
    what: "Unknown placeholders (e.g. {differed} in first_commence) render as empty strings. The Kind column is the primary key; do not rename existing kinds or add new ones — rows with unknown kinds are rejected on upload. Urgent takes Y or N. CC accepts a comma-separated mix of literal addresses and the tokens listed above.",
  });

  finaliseTemplateSheet(sheet);
  finaliseTemplateSheet(help);
  help.getColumn("what").alignment = { wrapText: true, vertical: "top" };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="emma_email_templates.xlsx"`,
    },
  });
}
