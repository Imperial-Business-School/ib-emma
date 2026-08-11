"use client";

import { useTransition } from "react";
import { toggleAbsentAction } from "../../actions";

// Present/Absent toggle for the admin exam-management seats table.
// If the click would flip a student from Present -> Absent AND that
// student has any saved grades, warns the admin first. Going the other
// way (Absent -> Present) never warns because absent rows never carry
// grades.
export function AbsenceToggleButton({
  examId,
  submissionId,
  isAbsent,
  hasGrades,
}: {
  examId: number;
  submissionId: number;
  isAbsent: boolean;
  hasGrades: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!isAbsent && hasGrades) {
      const ok = window.confirm(
        "Warning - this student's exam has been graded. Marking the student as absent will delete the grades given by markers. Are you sure you want to mark the student as absent?",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      await toggleAbsentAction(examId, submissionId);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={
        isAbsent ? "Mark student as present" : "Mark student as absent"
      }
      title={
        isAbsent
          ? "Absent — click to mark present"
          : hasGrades
            ? "Present — click to mark absent (will warn before deleting saved grades)"
            : "Present — click to mark absent"
      }
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        isAbsent
          ? "bg-slate-800 text-white"
          : "border bg-white text-slate-500 hover:bg-slate-50"
      } disabled:opacity-50`}
    >
      {pending ? "…" : isAbsent ? "Absent" : "Present"}
    </button>
  );
}
