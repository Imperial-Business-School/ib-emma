import Link from "next/link";
import {
  query,
  queryOne,
  type EmailLog,
} from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import { EmailLogFilters } from "./EmailLogFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 25;

type Sort = "sent_desc" | "sent_asc" | "recipient_asc";
const SORT_SQL: Record<Sort, string> = {
  sent_desc: "sent_at DESC",
  sent_asc: "sent_at ASC",
  recipient_asc: "lower(recipient) ASC, sent_at DESC",
};

function parseSort(v: string | undefined): Sort {
  if (v && v in SORT_SQL) return v as Sort;
  return "sent_desc";
}

function parseInt1(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

type EmailRow = EmailLog & { exam_name: string | null; exam_code: string | null };

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kind = (sp.kind ?? "").trim();
  const sort = parseSort(sp.sort);
  const pageSize = Math.min(100, parseInt1(sp.pageSize, PAGE_SIZE_DEFAULT));
  const page = parseInt1(sp.page, 1);

  const whereParts: string[] = [];
  const whereParams: unknown[] = [];
  if (q) {
    whereParams.push(`%${q.toLowerCase()}%`);
    whereParts.push(
      `(lower(e.recipient) LIKE $${whereParams.length} OR lower(coalesce(e.cc,'')) LIKE $${whereParams.length} OR lower(e.subject) LIKE $${whereParams.length})`,
    );
  }
  if (kind) {
    whereParams.push(kind);
    whereParts.push(`e.kind = $${whereParams.length}`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const totalRow = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM email_log e ${whereSql}`,
    whereParams,
  );
  const total = totalRow?.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const listParams = [...whereParams, pageSize, offset];
  const rows = await query<EmailRow>(
    `SELECT e.*, x.name AS exam_name, x.code AS exam_code
     FROM email_log e
     LEFT JOIN exams x ON x.id = e.exam_id
     ${whereSql}
     ORDER BY ${SORT_SQL[sort]}
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  // Distinct kinds for the filter dropdown.
  const kinds = await query<{ kind: string }>(
    `SELECT DISTINCT kind FROM email_log WHERE kind IS NOT NULL ORDER BY kind`,
  );

  const buildHref = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (kind) params.set("kind", kind);
    if (sort !== "sent_desc") params.set("sort", sort);
    if (pageSize !== PAGE_SIZE_DEFAULT)
      params.set("pageSize", String(pageSize));
    if (safePage !== 1) params.set("page", String(safePage));
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/admin/emails?${s}` : "/admin/emails";
  };

  const startRow = total === 0 ? 0 : offset + 1;
  const endRow = Math.min(offset + pageSize, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every email triggered by the app is recorded here, even while
          SMTP delivery is stubbed. Use this view to verify invitations and
          reminders, and as an audit trail.
        </p>
      </div>

      <EmailLogFilters
        initialQ={q}
        initialKind={kind}
        initialSort={sort}
        initialPageSize={pageSize}
        kinds={kinds.map((k) => k.kind)}
      />

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-600">
          <span>
            {total === 0
              ? "No emails match these filters."
              : `Showing ${startRow}–${endRow} of ${total}`}
          </span>
          <span>
            Page {safePage} of {totalPages}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 w-40">Sent</th>
              <th className="px-4 py-2 w-56">To</th>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2 w-40">Kind</th>
              <th className="px-4 py-2 w-48">Exam</th>
              <th className="px-4 py-2 w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No emails yet. Trigger one by starting marking on an exam,
                  or wait for an overdue sweep.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b last:border-b-0 align-top ${r.urgent ? "bg-red-50" : ""}`}
              >
                <td className="px-4 py-2 text-xs text-slate-700">
                  {formatDateTime(r.sent_at)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  <div>{r.recipient}</div>
                  {r.cc && (
                    <div className="text-slate-500">cc {r.cc}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <details>
                    <summary className="cursor-pointer">
                      {r.urgent && (
                        <span className="mr-1 rounded bg-red-200 px-1.5 py-0.5 text-xs font-medium text-red-900">
                          URGENT
                        </span>
                      )}
                      {r.subject}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-800">
                      {r.body}
                    </pre>
                  </details>
                </td>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {r.kind ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.exam_id && r.exam_name ? (
                    <Link
                      href={`/admin/exams/${r.exam_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.exam_code ?? r.exam_name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.delivery_status === "sent"
                        ? "bg-green-100 text-green-800"
                        : r.delivery_status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.delivery_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <Link
            href={buildHref({ page: safePage - 1 })}
            aria-disabled={safePage <= 1}
            className={`rounded border px-3 py-1.5 ${
              safePage <= 1
                ? "pointer-events-none border-slate-200 text-slate-300"
                : "bg-white hover:bg-slate-50"
            }`}
          >
            ← Previous
          </Link>
          <span className="text-xs text-slate-600">
            Page {safePage} of {totalPages}
          </span>
          <Link
            href={buildHref({ page: safePage + 1 })}
            aria-disabled={safePage >= totalPages}
            className={`rounded border px-3 py-1.5 ${
              safePage >= totalPages
                ? "pointer-events-none border-slate-200 text-slate-300"
                : "bg-white hover:bg-slate-50"
            }`}
          >
            Next →
          </Link>
        </div>
      </section>
    </div>
  );
}
