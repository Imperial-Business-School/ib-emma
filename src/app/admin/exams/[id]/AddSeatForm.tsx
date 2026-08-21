"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";
import { addSeatActionState } from "../../actions";

export function AddSeatForm({ examId }: { examId: number }) {
  const boundAction = addSeatActionState.bind(null, examId);
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    boundAction,
    SAVE_STATE_INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful add so the admin can queue up
  // the next seat without manually blanking them first.
  useEffect(() => {
    if (state.ok && state.error === null) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 flex gap-2"
      >
        <input
          name="seat"
          placeholder="Seat number"
          required
          className={`rounded border px-3 py-2 text-sm ${state.error ? "border-red-400" : ""}`}
        />
        <input
          name="cid"
          placeholder="CID"
          required
          className={`rounded border px-3 py-2 text-sm ${state.error ? "border-red-400" : ""}`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Add seat"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
    </>
  );
}
