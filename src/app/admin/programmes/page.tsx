import { PROGRAMME_LEVELS, query, type Programme } from "@/lib/db";
import { createProgrammeAction } from "./actions";
import { ProgrammeRow } from "./ProgrammeRow";

export const dynamic = "force-dynamic";

export default async function ProgrammesPage() {
  const programmes = await query<Programme>(
    "SELECT * FROM programmes ORDER BY lower(name)",
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Programmes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Master list of Business School programmes. Exams reference this list
          via a drop-down on the create-exam form.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Add programme</h2>
        <form
          action={createProgrammeAction}
          className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <input
            name="name"
            required
            placeholder="Programme name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="programme_id"
            required
            placeholder="Programme ID (e.g. MSc-BS-2025)"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            name="level"
            required
            defaultValue="MSc"
            className="rounded border bg-white px-3 py-2 text-sm"
          >
            {PROGRAMME_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Programme name</th>
              <th className="px-4 py-2">Programme ID</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {programmes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No programmes yet. Add one above.
                </td>
              </tr>
            )}
            {programmes.map((p) => (
              <ProgrammeRow key={p.id} programme={p} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
