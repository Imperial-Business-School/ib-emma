"use server";

import { revalidatePath } from "next/cache";
import { getActingAdmin, requireAdmin } from "@/lib/actor";
import {
  resetTemplateToDefault,
  saveTemplate,
} from "@/lib/emailTemplates";
import {
  EMAIL_TEMPLATE_KINDS,
  isEmailTemplateKind,
  type EmailTemplateKind,
} from "@/lib/emailTemplateKinds";
import { parseTabularFile } from "@/lib/tabular";
import { SAVE_STATE_INITIAL, toErrorState, type SaveState } from "@/lib/actionState";

const YES_VALUES = new Set(["y", "yes", "true", "1"]);
const NO_VALUES = new Set(["n", "no", "false", "0", ""]);

function parseUrgent(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (YES_VALUES.has(v)) return true;
  if (NO_VALUES.has(v)) return false;
  throw new Error(`Urgent must be Y or N (got "${raw}")`);
}

async function actingIdentity(): Promise<string | null> {
  const admin = await getActingAdmin();
  return admin?.name ?? admin?.email ?? null;
}

// Save one template (single-template edit form). Returns SaveState so
// the client renders inline validation errors instead of crashing.
export async function saveEmailTemplateAction(
  kind: EmailTemplateKind,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  try {
    await requireAdmin();
    if (!isEmailTemplateKind(kind)) {
      throw new Error(`Unknown template kind: ${kind}`);
    }
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "");
    const ccRaw = String(formData.get("cc") ?? "").trim();
    const urgentRaw = String(formData.get("urgent") ?? "");
    if (!subject) throw new Error("Subject cannot be empty");
    if (!body.trim()) throw new Error("Body cannot be empty");

    await saveTemplate(
      kind,
      {
        subject,
        body,
        cc: ccRaw === "" ? null : ccRaw,
        urgent: urgentRaw === "on" || urgentRaw === "true",
      },
      await actingIdentity(),
    );
    revalidatePath("/admin/emails/templates");
    return { ok: true, error: null };
  } catch (e) {
    return toErrorState(e);
  }
}

export async function resetEmailTemplateAction(
  kind: EmailTemplateKind,
): Promise<void> {
  await requireAdmin();
  if (!isEmailTemplateKind(kind)) {
    throw new Error(`Unknown template kind: ${kind}`);
  }
  await resetTemplateToDefault(kind, await actingIdentity());
  revalidatePath("/admin/emails/templates");
}

// Bulk upload from the downloadable XLSX. Validates every row first,
// then writes each in turn. All-or-nothing: any parse or validation
// error rejects the whole file and no templates are updated.
export async function uploadEmailTemplatesAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("No file uploaded");
    }
    const rows = await parseTabularFile(file);
    if (rows.length === 0) throw new Error("File is empty");

    // Header detection. Look for the "Kind" column; keep everything
    // else lax so admins can add helper columns to the sheet.
    const headerRow = rows[0].map((s) => s.trim().toLowerCase());
    const idx = {
      kind: headerRow.findIndex((c) => /^kind/i.test(c)),
      subject: headerRow.findIndex((c) => c === "subject"),
      body: headerRow.findIndex((c) => c === "body"),
      cc: headerRow.findIndex((c) => c === "cc"),
      urgent: headerRow.findIndex((c) => c.startsWith("urgent")),
    };
    if (idx.kind < 0 || idx.subject < 0 || idx.body < 0) {
      throw new Error(
        "File missing required columns. Expected at least Kind, Subject, Body.",
      );
    }

    const validKinds = new Set(EMAIL_TEMPLATE_KINDS as readonly string[]);
    const parsed: Array<{
      kind: EmailTemplateKind;
      subject: string;
      body: string;
      cc: string | null;
      urgent: boolean;
    }> = [];
    const seen = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const kind = (row[idx.kind] ?? "").trim();
      if (!kind) continue; // blank row -- skip
      if (!validKinds.has(kind)) {
        throw new Error(`Row ${r + 1}: unknown kind "${kind}"`);
      }
      if (seen.has(kind)) {
        throw new Error(`Row ${r + 1}: duplicate kind "${kind}"`);
      }
      seen.add(kind);
      const subject = (row[idx.subject] ?? "").trim();
      const body = (row[idx.body] ?? "");
      if (!subject) throw new Error(`Row ${r + 1}: subject is empty`);
      if (!body.trim()) throw new Error(`Row ${r + 1}: body is empty`);
      const cc =
        idx.cc >= 0 ? String(row[idx.cc] ?? "").trim() : "";
      const urgent =
        idx.urgent >= 0
          ? parseUrgent(String(row[idx.urgent] ?? ""))
          : false;
      parsed.push({
        kind: kind as EmailTemplateKind,
        subject,
        body,
        cc: cc === "" ? null : cc,
        urgent,
      });
    }

    if (parsed.length === 0) {
      throw new Error("No template rows found in the uploaded file");
    }

    const who = await actingIdentity();
    for (const p of parsed) {
      await saveTemplate(p.kind, p, who);
    }
    revalidatePath("/admin/emails/templates");
    return { ok: true, error: null };
  } catch (e) {
    return toErrorState(e);
  }
}

// Convenience: expose the initial SaveState so client components don't
// need to import it separately.
export const INITIAL_SAVE_STATE = SAVE_STATE_INITIAL;
