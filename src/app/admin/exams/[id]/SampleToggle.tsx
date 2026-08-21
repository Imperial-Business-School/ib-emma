"use client";

import { useState, useTransition } from "react";
import { toggleInSampleAction } from "../../actions";

// Checkbox for the second-marking sample column. Submits the toggle
// as soon as the box is (un)ticked and keeps the UI in sync with what
// the server accepts.
export function SampleToggle({
  examId,
  submissionId,
  initialChecked,
}: {
  examId: number;
  submissionId: number;
  initialChecked: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      aria-label={checked ? "Remove from sample" : "Add to sample"}
      title={checked ? "Click to remove from sample" : "Click to add to sample"}
      onChange={() => {
        const next = !checked;
        setChecked(next);
        startTransition(async () => {
          try {
            await toggleInSampleAction(examId, submissionId);
          } catch {
            setChecked(!next);
          }
        });
      }}
      className="h-4 w-4 cursor-pointer accent-blue-600 disabled:cursor-not-allowed"
    />
  );
}
