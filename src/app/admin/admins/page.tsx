import { query, type Admin } from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import { SubmitButton } from "@/components/SubmitButton";
import { createAdminAction } from "./actions";
import { AdminRow } from "./AdminRow";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const admins = await query<Admin>(
    "SELECT * FROM admins ORDER BY lower(name)",
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Admin users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anyone in this list can act as an admin. The system will always
          keep at least one admin, so add a new admin before removing the
          last one.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Add admin</h2>
        <form
          action={createAdminAction}
          className="mt-3 grid gap-3 md:grid-cols-[2fr_2fr_auto]"
        >
          <input
            name="name"
            required
            placeholder="Full name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="email@imperial.ac.uk"
            className="rounded border px-3 py-2 text-sm"
          />
          <SubmitButton
            label="Add"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          />
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Last accessed</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No admins yet.
                </td>
              </tr>
            )}
            {admins.map((a) => (
              <AdminRow
                key={a.id}
                admin={a}
                lastAccessLabel={
                  a.last_access_at ? formatDateTime(a.last_access_at) : "Never"
                }
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
