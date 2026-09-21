import Link from "next/link";
import { getAllTemplates } from "@/lib/emailTemplates";
import {
  CC_PLACEHOLDERS,
  EMAIL_TEMPLATE_KINDS,
  KIND_DESCRIPTIONS,
  PLACEHOLDERS,
  type EmailTemplateKind,
} from "@/lib/emailTemplateKinds";
import { formatDateTime } from "@/lib/datetime";
import { TemplateForm } from "./TemplateForm";
import { BulkTemplateUpload } from "./BulkTemplateUpload";
import { resetEmailTemplateAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const templates = await getAllTemplates();
  const byKind = new Map(templates.map((t) => [t.kind, t]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/admin/emails" className="text-blue-600 hover:underline">
            ← Email log
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold">Email templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every notification the app sends is built from one of the
          templates below. Edit the subject, body, CC list and urgent
          flag here to change what recipients see. Placeholders like{" "}
          <code>{"{marker_name}"}</code> and <code>{"{link}"}</code> are
          substituted at send time.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Bulk edit via spreadsheet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Download every template as one XLSX, edit in Excel, then upload
          the file back to update all templates in one go. All-or-nothing:
          if any row fails validation the whole file is rejected.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/api/admin/email-templates.xlsx"
            className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Download all as XLSX
          </a>
        </div>
        <BulkTemplateUpload />
      </section>

      {EMAIL_TEMPLATE_KINDS.map((kind) => {
        const row = byKind.get(kind);
        return (
          <section
            key={kind}
            className="rounded-lg border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
                    {kind}
                  </code>
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {KIND_DESCRIPTIONS[kind]}
                </p>
                {row?.updated_by && (
                  <p className="mt-1 text-xs text-slate-500">
                    Last edited{" "}
                    {row.updated_at
                      ? formatDateTime(row.updated_at)
                      : "unknown"}{" "}
                    by {row.updated_by}
                  </p>
                )}
              </div>
              <ResetForm kind={kind} />
            </div>
            <TemplateForm
              kind={kind}
              initialSubject={row?.subject ?? ""}
              initialBody={row?.body ?? ""}
              initialCc={row?.cc ?? ""}
              initialUrgent={row?.urgent ?? false}
              placeholders={PLACEHOLDERS[kind]}
              ccPlaceholders={CC_PLACEHOLDERS[kind]}
            />
          </section>
        );
      })}
    </div>
  );
}

function ResetForm({ kind }: { kind: EmailTemplateKind }) {
  return (
    <form
      action={async () => {
        "use server";
        await resetEmailTemplateAction(kind);
      }}
    >
      <SubmitButton
        label="Reset to default"
        pendingLabel="Resetting…"
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </form>
  );
}
