"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExamStatus } from "@/lib/db";

type Row = {
  id: number;
  name: string;
  code: string | null;
  status: ExamStatus;
  status_label: string;
  total: number;
  graded: number;
  created_at: string;
};

const STATUS_STYLES: Record<ExamStatus, string> = {
  setup: "bg-slate-100 text-slate-700",
  primary_marking: "bg-blue-100 text-blue-800",
  first_marking_review: "bg-purple-100 text-purple-800",
  secondary_marking: "bg-indigo-100 text-indigo-800",
  review: "bg-amber-100 text-amber-800",
  complete: "bg-green-100 text-green-800",
};

export function ExamSearch({ exams }: { exams: Row[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return exams;
    return exams.filter((e) => {
      const haystack = `${e.name} ${e.code ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [exams, q]);

  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <input
          type="search"
          placeholder="Search by exam title or module code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Code</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Progress</th>
            <th className="px-4 py-2">Created</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                {exams.length === 0
                  ? "No exams yet. Create one above."
                  : "No exams match that search."}
              </td>
            </tr>
          )}
          {filtered.map((e) => (
            <tr key={e.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">{e.name}</td>
              <td className="px-4 py-3 text-slate-600">{e.code ?? "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}
                >
                  {e.status_label}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {e.graded} / {e.total} primary
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(e.created_at).toLocaleDateString()}
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
    </section>
  );
}
