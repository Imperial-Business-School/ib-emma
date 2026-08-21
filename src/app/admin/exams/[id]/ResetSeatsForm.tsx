"use client";

import { useTransition } from "react";
import { resetSeatsAction } from "../../actions";

export function ResetSeatsForm({
  examId,
  count,
}: {
  examId: number;
  count: number;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        `Are you sure you want to reset the seat list? This deletes all ${count} seat/CID rows for this exam.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await resetSeatsAction(examId);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || count === 0}
      className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Submitting…" : `Reset seat list`}
    </button>
  );
}
