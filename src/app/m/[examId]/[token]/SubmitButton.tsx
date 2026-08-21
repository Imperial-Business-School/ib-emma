"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

// Submit button that disables itself while its parent <form>'s server
// action is in flight, so a double click doesn't re-fire the action
// against a state the first click has already advanced. Also scrolls
// the page back to the top when the action completes so the marker
// notices the newly rendered success banner instead of staying deep
// inside the grades table.
export function SubmitButton({
  label,
  pendingLabel = "Submitting…",
  disabled = false,
  className,
}: {
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasPending.current = pending;
  }, [pending]);
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
