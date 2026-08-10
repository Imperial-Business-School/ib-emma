"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActingAdminAction } from "./actor-actions";

type Row = { id: number; name: string };

export function ActingAsPicker({
  admins,
  currentId,
}: {
  admins: Row[];
  currentId: number | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (admins.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">Acting as</span>
      <select
        defaultValue={currentId ?? admins[0].id}
        onChange={(e) => {
          const id = Number(e.target.value);
          startTransition(async () => {
            await setActingAdminAction(id);
            router.refresh();
          });
        }}
        className="rounded border bg-white px-2 py-1 text-xs"
      >
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
