import Link from "next/link";
import { headers } from "next/headers";
import {
  EXAM_STATUS_LABEL,
  query,
  queryOne,
  type Exam,
  type ExamStatus,
} from "@/lib/db";
import { STATUS_BADGE_CLASS } from "@/lib/examStatus";
import { sweepDeadlineStatuses } from "@/lib/deadlines";
import { ExamFilters, type ExamType } from "../admin/ExamFilters";
import { formatDate } from "@/lib/datetime";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export const dynamic = "force-dynamic";

type ExamRow = Exam & { total: number; graded: number };

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

function parseType(v: string | undefined): ExamType | null {
  if (v === "main" || v === "resit") return v;
  return null;
}

export default async function ExamsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
    programme?: string;
    year?: string;
    type?: string;
  }>;
}) {
  await sweepDeadlineStatuses({ origin: await getOrigin() });
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = parseStatus(sp.status);
  const sort = parseSort(sp.sort);
  const pageSize = Math.min(100, parseInt1(sp.pageSize, PAGE_SIZE_DEFAULT));
  const page = parseInt1(sp.page, 1);
  const programmeIdRaw = sp.programme?.trim();
  const programmeId =
    programmeIdRaw && /^\d+$/.test(programmeIdRaw)
      ? Number(programmeIdRaw)
      : null;
  const academicYear =
    sp.year && /^\d{2}\/\d{2}$/.test(sp.year.trim()) ? sp.year.trim() : null;
  const type = parseType(sp.type);

  // Options for the filter dropdowns. Academic-year list comes from the
  // exams actually stored (distinct, newest first).
  const programmes = await query<{ id: number; name: string }>(
    "SELECT id, name FROM programmes ORDER BY lower(name)",
  );
  const academicYears = (
    await query<{ academic_year: string }>(
      `SELECT DISTINCT academic_year FROM exams
       WHERE academic_year IS NOT NULL
       ORDER BY academic_year DESC`,
    )
  ).map((r) => r.academic_year);

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
  if (programmeId != null) {
    whereParams.push(programmeId);
    whereParts.push(`e.programme_id = $${whereParams.length}`);
  }
  if (academicYear) {
    whereParams.push(academicYear);
    whereParts.push(`e.academic_year = $${whereParams.length}`);
  }
  if (type) {
    whereParams.push(type === "resit");
    whereParts.push(`e.is_resit = $${whereParams.length}`);
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

  const buildHref = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort !== "created_desc") params.set("sort", sort);
    if (pageSize !== PAGE_SIZE_DEFAULT) params.set("pageSize", String(pageSize));
    if (safePage !== 1) params.set("page", String(safePage));
    if (programmeId != null) params.set("programme", String(programmeId));
    if (academicYear) params.set("year", academicYear);
    if (type) params.set("type", type);
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/exams?${s}` : "/exams";
  };

  const startRow = total === 0 ? 0 : safeOffset + 1;
  const endRow = Math.min(safeOffset + pageSize, total);

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every exam in the system. Use the search and filters to find one.
          </p>
        </div>
        <Link
          href="/exams/create"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Create exam
        </Link>
      </section>

      <ExamFilters
        initialQ={q}
        initialStatus={status ?? "all"}
        initialSort={sort}
        initialPageSize={pageSize}
        initialProgrammeId={programmeId ?? "all"}
        initialAcademicYear={academicYear ?? "all"}
        initialType={type ?? "all"}
        programmes={programmes}
        academicYears={academicYears}
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
                    : "No exams yet. Click Create exam."}
                </td>
              </tr>
            )}
            {exams.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">
                  {e.name}
                  {e.is_resit && (
                    <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">
                      Resit
                    </span>
                  )}
                </td>
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
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {EXAM_STATUS_LABEL[status]}
    </span>
  );
}
