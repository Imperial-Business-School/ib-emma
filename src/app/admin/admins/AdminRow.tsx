"use client";

import { useState, useTransition } from "react";
import type { Admin } from "@/lib/examStatus";
import { deleteAdminAction, updateAdminAction } from "./actions";

export function AdminRow({
  admin,
  lastAccessLabel,
}: {
  admin: Admin;
  lastAccessLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);

  function onSave() {
    if (
      !window.confirm(
        `Are you sure you want to save these changes to "${admin.name}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("email", email);
        await updateAdminAction(admin.id, fd);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function onDelete() {
    const typed = window.prompt(
      `To delete admin "${admin.name}", type their name exactly:`,
    );
    if (typed == null) return;
    if (
      !window.confirm(
        `Are you sure you want to delete admin "${admin.name}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("confirm_name", typed);
        await deleteAdminAction(admin.id, fd);
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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </td>
        <td className="px-4 py-2 text-xs text-slate-500">{lastAccessLabel}</td>
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
                setName(admin.name);
                setEmail(admin.email);
                setError(null);
              }}
              className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 font-medium">{admin.name}</td>
      <td className="px-4 py-2 font-mono text-slate-700">{admin.email}</td>
      <td className="px-4 py-2 text-xs text-slate-600">{lastAccessLabel}</td>
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
