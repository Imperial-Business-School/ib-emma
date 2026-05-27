import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne, type Exam } from "@/lib/db";
import {
  allocateMarkerAction,
  removeMarkerAction,
  resendInviteAction,
} from "./actions";

export const dynamic = "force-dynamic";

type MarkerRow = {
  user_id: number;
  email: string;
  name: string | null;
  created_at: string;
  last_login_at: string | null;
};

export default async function MarkersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) notFound();

  const markers = await query<MarkerRow>(
    `SELECT u.id AS user_id, u.email, u.name, em.created_at, u.last_login_at
     FROM exam_markers em
     JOIN users u ON u.id = em.user_id
     WHERE em.exam_id = $1
     ORDER BY em.created_at`,
    [examId],
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/exams/${examId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to exam
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Markers · {exam.name}</h1>
        <p className="text-sm text-slate-600">
          Only allocated markers can view this exam.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Allocate a marker</h2>
        <p className="mt-1 text-sm text-slate-600">
          The marker receives a sign-in email immediately. CIDs are never
          shown to them.
        </p>
        <form
          action={async (fd) => {
            "use server";
            await allocateMarkerAction(examId, fd);
          }}
          className="mt-3 grid gap-2 md:grid-cols-[2fr_2fr_auto]"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="marker@imperial.ac.uk"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="name"
            placeholder="Name (optional)"
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Allocate & invite
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Allocated markers</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Allocated</th>
              <th className="px-4 py-2">Last sign-in</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {markers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No markers allocated yet.
                </td>
              </tr>
            )}
            {markers.map((m) => (
              <tr key={m.user_id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono">{m.email}</td>
                <td className="px-4 py-2">{m.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {m.last_login_at
                    ? new Date(m.last_login_at).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <form
                      action={async () => {
                        "use server";
                        await resendInviteAction(examId, m.user_id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Resend link
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await removeMarkerAction(examId, m.user_id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
