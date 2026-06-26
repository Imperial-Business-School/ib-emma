"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Sort = "sent_desc" | "sent_asc" | "recipient_asc";

const SORT_LABELS: Record<Sort, string> = {
  sent_desc: "Newest first",
  sent_asc: "Oldest first",
  recipient_asc: "Recipient (A → Z)",
};

export function EmailLogFilters({
  initialQ,
  initialKind,
  initialSort,
  initialPageSize,
  kinds,
}: {
  initialQ: string;
  initialKind: string;
  initialSort: Sort;
  initialPageSize: number;
  kinds: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(initialQ);
  const [kind, setKind] = useState(initialKind);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (kind) params.set("kind", kind);
    if (sort !== "sent_desc") params.set("sort", sort);
    if (pageSize !== 25) params.set("pageSize", String(pageSize));
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/emails?${qs}` : "/admin/emails");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, kind, sort, pageSize]);

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by recipient, cc or subject…"
          className="rounded border px-3 py-2 text-sm"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm"
        >
          <option value="">All kinds</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
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
