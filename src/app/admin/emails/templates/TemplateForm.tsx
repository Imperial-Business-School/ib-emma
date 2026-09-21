"use client";

import { useActionState } from "react";
import {
  SAVE_STATE_INITIAL,
  type SaveState,
} from "@/lib/actionState";
import type { EmailTemplateKind } from "@/lib/emailTemplateKinds";
import { saveEmailTemplateAction } from "./actions";

export function TemplateForm({
  kind,
  initialSubject,
  initialBody,
  initialCc,
  initialUrgent,
  placeholders,
  ccPlaceholders,
}: {
  kind: EmailTemplateKind;
  initialSubject: string;
  initialBody: string;
  initialCc: string;
  initialUrgent: boolean;
  placeholders: readonly string[];
  ccPlaceholders: readonly string[];
}) {
  const boundAction = saveEmailTemplateAction.bind(null, kind);
  const [state, formAction, pending] = useActionState<SaveState, FormData>(
    boundAction,
    SAVE_STATE_INITIAL,
  );

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600">
            Subject
          </span>
          <input
            name="subject"
            defaultValue={initialSubject}
            required
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600">
            Body
          </span>
          <textarea
            name="body"
            defaultValue={initialBody}
            required
            rows={14}
            className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs leading-snug"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600">
            CC (comma-separated addresses and/or tokens)
          </span>
          <input
            name="cc"
            defaultValue={initialCc}
            placeholder="e.g. exam.manager@ic.ac.uk, {other_admins}"
            className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="urgent"
            defaultChecked={initialUrgent}
            className="h-4 w-4 accent-blue-600"
          />
          <span>Mark as urgent (renders red banner in the Email log)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {state.ok && !state.error && (
            <span className="text-xs text-green-700">Saved.</span>
          )}
          {state.error && (
            <span className="text-xs text-red-700">{state.error}</span>
          )}
        </div>
      </div>
      <aside className="rounded border border-slate-200 bg-slate-50 p-3 text-xs">
        <h4 className="font-semibold text-slate-700">Available placeholders</h4>
        <p className="mt-1 text-slate-500">
          Use these in the subject or body. Unknown tokens render empty.
        </p>
        <ul className="mt-2 space-y-1 font-mono text-[11px]">
          {placeholders.map((p) => (
            <li key={p}>{"{" + p + "}"}</li>
          ))}
        </ul>
        {ccPlaceholders.length > 0 && (
          <>
            <h4 className="mt-3 font-semibold text-slate-700">CC-only tokens</h4>
            <ul className="mt-1 space-y-1 font-mono text-[11px]">
              {ccPlaceholders.map((p) => (
                <li key={p}>{"{" + p + "}"}</li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </form>
  );
}
