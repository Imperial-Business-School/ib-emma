"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables itself while its parent <form>'s server
// action is in flight, so a double click doesn't re-fire the action
// against a state the first click has already advanced.
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
