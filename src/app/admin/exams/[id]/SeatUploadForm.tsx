"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";
import { uploadSeatsActionState } from "../../actions";

export function SeatUploadForm({ examId }: { examId: number }) {
  const boundAction = uploadSeatsActionState.bind(null, examId);
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    boundAction,
    SAVE_STATE_INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the file input on a successful upload so a follow-up upload
  // starts fresh instead of re-submitting the same file.
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
        className="mt-3 flex items-center gap-3"
      >
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending ? "Uploading…" : "Upload"}
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
