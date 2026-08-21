"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EXAM_STATUS_LABEL, type ExamStatus } from "@/lib/examStatus";

type Sort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "status_asc";

const SORT_LABELS: Record<Sort, string> = {
  created_desc: "Newest first",
  created_asc: "Oldest first",
  name_asc: "Name (A → Z)",
  name_desc: "Name (Z → A)",
  status_asc: "Status",
};

type ProgrammeOption = { id: number; name: string };

export type ExamType = "main" | "resit";

export function ExamFilters({
  initialQ,
  initialStatus,
  initialSort,
  initialPageSize,
  initialProgrammeId,
  initialAcademicYear,
  initialType,
  programmes,
  academicYears,
}: {
  initialQ: string;
  initialStatus: ExamStatus | "all";
  initialSort: Sort;
  initialPageSize: number;
  initialProgrammeId: number | "all";
  initialAcademicYear: string | "all";
  initialType: ExamType | "all";
  programmes: ProgrammeOption[];
  academicYears: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<ExamStatus | "all">(initialStatus);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [programmeId, setProgrammeId] =
    useState<number | "all">(initialProgrammeId);
  const [academicYear, setAcademicYear] =
    useState<string | "all">(initialAcademicYear);
  const [type, setType] = useState<ExamType | "all">(initialType);

  // Debounce the text input so typing doesn't refetch on every keystroke.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (status !== "all") params.set("status", status);
    if (sort !== "created_desc") params.set("sort", sort);
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    if (programmeId !== "all") params.set("programme", String(programmeId));
    if (academicYear !== "all") params.set("year", academicYear);
    if (type !== "all") params.set("type", type);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/exams?${qs}` : "/exams");
    });
    // intentional: react to filter state only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, pageSize, programmeId, academicYear, type]);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or module code…"
          className="min-w-[200px] flex-1 basis-[220px] rounded border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ExamStatus | "all")}
          className="rounded border bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {(Object.keys(EXAM_STATUS_LABEL) as ExamStatus[]).map((s) => (
            <option key={s} value={s}>
              {EXAM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={programmeId === "all" ? "all" : String(programmeId)}
          onChange={(e) => {
            const v = e.target.value;
            setProgrammeId(v === "all" ? "all" : Number(v));
          }}
          className="rounded border bg-white px-3 py-2 text-sm"
          aria-label="Filter by programme"
        >
          <option value="all">All programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm"
          aria-label="Filter by academic year"
        >
          <option value="all">All years</option>
          {academicYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ExamType | "all")}
          className="rounded border bg-white px-3 py-2 text-sm"
          aria-label="Filter by exam type"
        >
          <option value="all">Main + resit</option>
          <option value="main">Main sitting</option>
          <option value="resit">Resit</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded border bg-white px-3 py-2 text-sm"
        >
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded border bg-white px-3 py-2 text-sm"
          aria-label="Rows per page"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
