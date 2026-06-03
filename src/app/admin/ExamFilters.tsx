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

export function ExamFilters({
  initialQ,
  initialStatus,
  initialSort,
  initialPageSize,
}: {
  initialQ: string;
  initialStatus: ExamStatus | "all";
  initialSort: Sort;
  initialPageSize: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<ExamStatus | "all">(initialStatus);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [pageSize, setPageSize] = useState(initialPageSize);

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
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin?${qs}` : "/admin");
    });
    // intentional: react to filter state only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, sort, pageSize]);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or module code…"
          className="rounded border px-3 py-2 text-sm"
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
