"use client";

import { useActionState } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";
import { todayUkIsoDate } from "@/lib/datetime";

// Inline deadline editor. The <input type="date"> enforces min=today
// client-side; the server action enforces the same constraint again.
// Errors from the server surface below the input rather than crashing
// the page.
export function DeadlineForm({
  action,
  name,
  defaultValue,
  helper,
}: {
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  name: string;
  defaultValue: string;
  helper?: string;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    action,
    SAVE_STATE_INITIAL,
  );
  const today = todayUkIsoDate();
  return (
    <form action={formAction} className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          name={name}
          defaultValue={defaultValue}
          min={today}
          required
          className={`rounded border px-2 py-1 text-sm ${state.error ? "border-red-400" : ""}`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {pending ? "Submitting…" : "Save"}
        </button>
      </div>
      {helper && !state.error && (
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      )}
      {state.error && (
        <p className="mt-1 text-xs text-red-700">{state.error}</p>
      )}
    </form>
  );
}
