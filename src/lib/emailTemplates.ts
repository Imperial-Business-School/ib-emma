import { query, queryOne, type EmailTemplateRow } from "./db";
import { DEFAULT_TEMPLATES, type EmailTemplateDefault } from "./emailDefaults";
import {
  KIND_DESCRIPTIONS,
  type EmailTemplateKind,
} from "./emailTemplateKinds";

// In-memory cache of every template. Invalidated on save/reset so admins
// never see stale wording. Set-once semantics: we load all rows in one
// query the first time getTemplate is called (or after invalidation).
let cachePromise: Promise<Map<string, EmailTemplateRow>> | null = null;

async function loadAll(): Promise<Map<string, EmailTemplateRow>> {
  const rows = await query<EmailTemplateRow>(
    "SELECT * FROM email_templates",
  );
  return new Map(rows.map((r) => [r.kind, r]));
}

function ensureCache(): Promise<Map<string, EmailTemplateRow>> {
  if (!cachePromise) cachePromise = loadAll();
  return cachePromise;
}

export function invalidateEmailTemplateCache(): void {
  cachePromise = null;
}

// Fallback row when the DB row is somehow missing (shouldn't happen after
// the init-time seed but keeps the send path robust).
function fallbackRow(kind: EmailTemplateKind): EmailTemplateRow {
  const def: EmailTemplateDefault = DEFAULT_TEMPLATES[kind];
  return {
    kind,
    subject: def.subject,
    body: def.body,
    cc: def.cc,
    urgent: def.urgent,
    description: KIND_DESCRIPTIONS[kind],
    updated_at: new Date(0).toISOString(),
    updated_by: null,
  };
}

export async function getTemplate(
  kind: EmailTemplateKind,
): Promise<EmailTemplateRow> {
  const cache = await ensureCache();
  return cache.get(kind) ?? fallbackRow(kind);
}

export async function getAllTemplates(): Promise<EmailTemplateRow[]> {
  const cache = await ensureCache();
  return Array.from(cache.values());
}

// Render {placeholder} substitutions. Unknown or null-valued placeholders
// render as empty strings so a typo never leaks the raw token to a real
// email recipient.
export function renderTemplate(
  text: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

// Expand a CC template string into a comma-separated recipient list.
// Supported tokens: {second_marker}, {other_admins}. Everything else is
// treated as a literal address (or dropped if it's an unknown token).
export function renderCcList(
  ccTemplate: string | null,
  ctx: {
    secondMarkerEmail?: string | null;
    otherAdminEmails?: string[];
  },
): string | undefined {
  if (!ccTemplate) return undefined;
  const parts = ccTemplate
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const resolved: string[] = [];
  for (const raw of parts) {
    if (raw === "{second_marker}") {
      if (ctx.secondMarkerEmail) resolved.push(ctx.secondMarkerEmail);
    } else if (raw === "{other_admins}") {
      if (ctx.otherAdminEmails?.length)
        resolved.push(...ctx.otherAdminEmails);
    } else if (raw.startsWith("{") && raw.endsWith("}")) {
      // Unknown placeholder — drop silently.
    } else {
      resolved.push(raw);
    }
  }
  return resolved.length > 0 ? resolved.join(", ") : undefined;
}

// Bulk-write from an uploaded XLSX/CSV.
export async function saveTemplate(
  kind: EmailTemplateKind,
  patch: {
    subject: string;
    body: string;
    cc: string | null;
    urgent: boolean;
  },
  updatedBy: string | null,
): Promise<void> {
  await query(
    `UPDATE email_templates
     SET subject = $1,
         body = $2,
         cc = $3,
         urgent = $4,
         updated_at = now(),
         updated_by = $5
     WHERE kind = $6`,
    [patch.subject, patch.body, patch.cc, patch.urgent, updatedBy, kind],
  );
  invalidateEmailTemplateCache();
}

export async function resetTemplateToDefault(
  kind: EmailTemplateKind,
  updatedBy: string | null,
): Promise<void> {
  const def = DEFAULT_TEMPLATES[kind];
  await query(
    `UPDATE email_templates
     SET subject = $1,
         body = $2,
         cc = $3,
         urgent = $4,
         updated_at = now(),
         updated_by = $5
     WHERE kind = $6`,
    [def.subject, def.body, def.cc, def.urgent, updatedBy, kind],
  );
  invalidateEmailTemplateCache();
}

// Silence unused-import warning: queryOne is available if we later add
// a single-row read path elsewhere.
void queryOne;
