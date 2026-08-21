"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

// Reusable submit button. While its parent <form>'s action is in
// flight, the button is disabled and its label swaps to
// "Submitting…", so the user always knows their click has registered
// and a second click can't re-fire the action.
//
// Optional scrollToTop prop scrolls the window to the top when the
// pending state ends (used for large state transitions like the
// marker completion buttons, so the fresh page state is visible).
export function SubmitButton({
  label,
  pendingLabel = "Submitting…",
  disabled = false,
  className,
  scrollToTop = false,
}: {
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
  scrollToTop?: boolean;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (
      scrollToTop &&
      wasPending.current &&
      !pending &&
      typeof window !== "undefined"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasPending.current = pending;
  }, [pending, scrollToTop]);
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
