"use client";

import { useState, useTransition } from "react";
import { deleteExamAction } from "../../actions";

export function DeleteExamForm({
  examId,
  examName,
}: {
  examId: number;
  examName: string;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (confirmName !== examName) {
      setError("Type the exam name exactly to enable deletion.");
      return;
    }
    if (
      !window.confirm(`Are you sure you want to delete this exam "${examName}"?`)
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("confirm_name", confirmName);
      try {
        await deleteExamAction(examId, fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div>
      <h3 className="font-semibold text-red-800">Delete exam</h3>
      <p className="mt-1 text-sm text-red-700">
        Permanently removes the exam and every seat, grade and comment. This
        cannot be undone. Type the exam name below to enable the delete
        button.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={examName}
          className="w-72 rounded border border-red-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="rounded border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Delete this exam"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
