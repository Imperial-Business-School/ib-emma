"use client";

import { useActionState } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";

// Single-input form used for the per-seat grade/MCQ cells. Renders any
// server-side validation error inline under the input instead of
// crashing the page.
export function InlineSaveForm({
  action,
  defaultValue,
  name = "value",
  pattern,
  inputMode,
  placeholder = "—",
  title,
  inputClassName = "w-20 rounded border px-2 py-1 text-sm",
}: {
  action: (prev: SaveState, fd: FormData) => Promise<SaveState>;
  defaultValue: string;
  name?: string;
  pattern?: string;
  inputMode?: "decimal" | "numeric" | "text";
  placeholder?: string;
  title?: string;
  inputClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    action,
    SAVE_STATE_INITIAL,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1" title={title}>
      <div className="flex gap-1">
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          pattern={pattern}
          inputMode={inputMode}
          className={`${inputClassName} ${state.error ? "border-red-400" : ""}`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-700">{state.error}</p>
      )}
    </form>
  );
}
