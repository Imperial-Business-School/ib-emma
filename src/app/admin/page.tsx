import Link from "next/link";
import {
  EXAM_STATUS_LABEL,
  query,
  queryOne,
  type Exam,
  type ExamStatus,
} from "@/lib/db";
import { createExamAction } from "./actions";
import { ExamFilters } from "./ExamFilters";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type ExamRow = Exam & { total: number; graded: number; total_count: number };

const PAGE_SIZE_DEFAULT = 25;

type SortKey =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "status_asc";

const SORT_SQL: Record<SortKey, string> = {
  created_desc: "e.created_at DESC",
  created_asc: "e.created_at ASC",
  name_asc: "lower(e.name) ASC",
  name_desc: "lower(e.name) DESC",
  status_asc: "e.status ASC, e.created_at DESC",
};

function parseSort(v: string | undefined): SortKey {
  if (v && v in SORT_SQL) return v as SortKey;
  return "created_desc";
}

function parseStatus(v: string | undefined): ExamStatus | null {
  if (!v || v === "all") return null;
  if (v in EXAM_STATUS_LABEL) return v as ExamStatus;
  return null;
}

function parseInt1(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = parseStatus(sp.status);
  const sort = parseSort(sp.sort);
  const pageSize = Math.min(100, parseInt1(sp.pageSize, PAGE_SIZE_DEFAULT));
  const page = parseInt1(sp.page, 1);
  const offset = (page - 1) * pageSize;

  // Build the WHERE clause and params for both the count and the list query.
  const whereParts: string[] = [];
  const whereParams: unknown[] = [];
  if (q) {
    whereParams.push(`%${q.toLowerCase()}%`);
    whereParts.push(
      `(lower(e.name) LIKE $${whereParams.length} OR lower(coalesce(e.code, '')) LIKE $${whereParams.length})`,
    );
  }
  if (status) {
    whereParams.push(status);
    whereParts.push(`e.status = $${whereParams.length}`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const totalRow = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exams e ${whereSql}`,
    whereParams,
  );
  const total = totalRow?.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const safeOffset = (safePage - 1) * pageSize;

  const listParams = [...whereParams, pageSize, safeOffset];
  const exams = await query<ExamRow>(
    `SELECT e.*,
            (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id)::int AS total,
            (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.grade IS NOT NULL)::int AS graded
     FROM exams e
     ${whereSql}
     ORDER BY ${SORT_SQL[sort]}
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  // Build URLs that preserve filters when changing pages.
  const buildHref = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort !== "created_desc") params.set("sort", sort);
    if (pageSize !== PAGE_SIZE_DEFAULT)
      params.set("pageSize", String(pageSize));
    if (safePage !== 1) params.set("page", String(safePage));
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  const startRow = total === 0 ? 0 : safeOffset + 1;
  const endRow = Math.min(safeOffset + pageSize, total);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Admin · Exams</h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin sees everything: seat numbers, CIDs, and grades from both markers.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create exam</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter both markers and pick a sampling mode. The sampling mode is
          locked once primary marking starts.
        </p>
        <form action={createExamAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Exam name (e.g. MATH40001 Analysis I)"
            className="rounded border px-3 py-2 md:col-span-2"
          />
          <input
            name="code"
            placeholder="Module code (optional)"
            className="rounded border px-3 py-2 md:col-span-2"
          />
          <fieldset className="rounded border bg-slate-50 p-3 md:col-span-2">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">
              Second marking
            </legend>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="sampling_mode"
                value="standard"
                defaultChecked
                className="mt-1"
              />
              <span>
                <strong>Standard sampling</strong> — at least 10% of papers,
                including all grade-boundary papers (39–41, 49–51, 59–61, 69–71,
                79–81).
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="sampling_mode"
                value="full"
                className="mt-1"
              />
              <span>
                <strong>Full second marking</strong> — every paper is marked
                by the second marker.
              </span>
            </label>
          </fieldset>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Primary marker
            </p>
            <input
              type="email"
              name="primary_email"
              required
              placeholder="primary@imperial.ac.uk"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
            <input
              name="primary_name"
              placeholder="Name (optional)"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Second marker
            </p>
            <input
              type="email"
              name="secondary_email"
              required
              placeholder="second@imperial.ac.uk"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
            <input
              name="secondary_name"
              placeholder="Name (optional)"
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 md:col-span-2"
          >
            Create exam
          </button>
        </form>
      </section>

      <ExamFilters
        initialQ={q}
        initialStatus={status ?? "all"}
        initialSort={sort}
        initialPageSize={pageSize}
      />

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-slate-600">
          <span>
            {total === 0
              ? "No exams match these filters."
              : `Showing ${startRow}–${endRow} of ${total}`}
          </span>
          <span>
            Page {safePage} of {totalPages}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">
                <SortLink
                  current={sort}
                  asc="name_asc"
                  desc="name_desc"
                  label="Name"
                  href={(s) => buildHref({ sort: s, page: 1 })}
                />
              </th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">
                <SortLink
                  current={sort}
                  asc="status_asc"
                  label="Status"
                  href={(s) => buildHref({ sort: s, page: 1 })}
                />
              </th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">
                <SortLink
                  current={sort}
                  asc="created_asc"
                  desc="created_desc"
                  label="Created"
                  href={(s) => buildHref({ sort: s, page: 1 })}
                />
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {total === 0 && (q || status)
                    ? "No exams match these filters."
                    : "No exams yet. Create one above."}
                </td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.code ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={e.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.graded} / {e.total} primary
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(e.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/exams/${e.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Manage →
                  </Link>
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

function SortLink({
  current,
  asc,
  desc,
  label,
  href,
}: {
  current: SortKey;
  asc: SortKey;
  desc?: SortKey;
  label: string;
  href: (sort: SortKey) => string;
}) {
  // Toggle between asc and (if provided) desc when the column is already
  // active. Otherwise default to asc.
  const next: SortKey =
    current === asc && desc ? desc : current === desc ? asc : asc;
  const arrow =
    current === asc ? " ↑" : desc && current === desc ? " ↓" : "";
  return (
    <Link href={href(next)} className="hover:text-slate-900">
      {label}
      <span className="text-slate-400">{arrow}</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: ExamStatus }) {
  const styles: Record<ExamStatus, string> = {
    setup: "bg-slate-100 text-slate-700",
    primary_marking: "bg-blue-100 text-blue-800",
    first_marking_review: "bg-purple-100 text-purple-800",
    secondary_marking: "bg-indigo-100 text-indigo-800",
    review: "bg-amber-100 text-amber-800",
    complete: "bg-green-100 text-green-800",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {EXAM_STATUS_LABEL[status]}
    </span>
  );
}
