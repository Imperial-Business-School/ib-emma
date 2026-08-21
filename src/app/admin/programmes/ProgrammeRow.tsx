"use client";

import { useState, useTransition } from "react";
import { PROGRAMME_LEVELS, type Programme } from "@/lib/examStatus";
import {
  deleteProgrammeAction,
  updateProgrammeAction,
} from "./actions";

export function ProgrammeRow({ programme }: { programme: Programme }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(programme.name);
  const [progId, setProgId] = useState(programme.programme_id);
  const [level, setLevel] = useState<Programme["level"]>(programme.level);

  function onSave() {
    if (
      !window.confirm(
        `Are you sure you want to save these changes to "${programme.name}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("programme_id", progId);
        fd.set("level", level);
        await updateProgrammeAction(programme.id, fd);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function onDelete() {
    const typed = window.prompt(
      `To delete "${programme.name}", type its name exactly:`,
    );
    if (typed == null) return;
    if (
      !window.confirm(
        `Are you sure you want to delete the programme "${programme.name}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("confirm_name", typed);
        await deleteProgrammeAction(programme.id, fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-b bg-slate-50 last:border-b-0 align-top">
        <td className="px-4 py-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={progId}
            onChange={(e) => setProgId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={level}
            onChange={(e) =>
              setLevel(e.target.value as Programme["level"])
            }
            className="rounded border bg-white px-2 py-1 text-sm"
          >
            {PROGRAMME_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {pending ? "Submitting…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(programme.name);
                setProgId(programme.programme_id);
                setLevel(programme.level);
                setError(null);
              }}
              className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-700">{error}</p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 font-medium">{programme.name}</td>
      <td className="px-4 py-2 font-mono text-slate-700">
        {programme.programme_id}
      </td>
      <td className="px-4 py-2">{programme.level}</td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </td>
    </tr>
  );
}
