"use client";

import { useActionState } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";
import { uploadEmailTemplatesAction } from "./actions";

export function BulkTemplateUpload() {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    uploadEmailTemplatesAction,
    SAVE_STATE_INITIAL,
  );
  return (
    <form
      action={formAction}
      className="mt-3 flex flex-wrap items-center gap-3"
    >
      <input
        type="file"
        name="file"
        accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        className="text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload templates"}
      </button>
      {state.ok && !state.error && (
        <span className="text-xs text-green-700">
          Templates updated.
        </span>
      )}
      {state.error && (
        <pre className="w-full whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-800">
          {state.error}
        </pre>
      )}
    </form>
  );
}
