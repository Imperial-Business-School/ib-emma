"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";

// Wraps a marker's "Submit marks" / "Submit final marks" form with a
// useActionState-driven action so a server-side validation throw
// (e.g. mismatched grade with no comment) renders as a friendly
// inline error instead of Next.js's default server-component error
// box. Any helper copy that lived under the button in the original
// form is passed in as children so the layout stays identical.
//
// The marker's click opens a confirm dialog first ("Grades cannot be
// changed after submission"); only after they hit Submit in that
// dialog do we actually fire the server action.
export function CompleteMarkingButton({
  action,
  label,
  disabled,
  className,
  children,
}: {
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  label: string;
  disabled?: boolean;
  className: string;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState<SaveState, FormData>(
    action,
    SAVE_STATE_INITIAL,
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirmedRef.current) {
      e.preventDefault();
      setShowConfirm(true);
    }
  }

  function onConfirm() {
    confirmedRef.current = true;
    setShowConfirm(false);
    formRef.current?.requestSubmit();
  }

  function onCancel() {
    setShowConfirm(false);
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
      <SubmitButton
        label={label}
        disabled={disabled}
        scrollToTop
        className={className}
      />
      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          An error prevented marks from being submitted. Please check the
          page below.
        </p>
      )}
      {children}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
          onClick={onCancel}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-submit-title"
              className="text-lg font-semibold text-slate-900"
            >
              Are you sure?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Grades cannot be changed after submission.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
