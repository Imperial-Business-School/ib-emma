import Link from "next/link";
import { getActingAdmin, getAllAdmins } from "@/lib/actor";
import { ActingAsPicker } from "./ActingAsPicker";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, admins] = await Promise.all([
    getActingAdmin(),
    getAllAdmins(),
  ]);

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/admin"
            className="flex items-baseline gap-2 text-lg font-semibold"
            title="Exam Marking & Moderation App"
          >
            <span>EMMA</span>
            <span className="hidden text-xs font-normal text-slate-500 sm:inline">
              Exam Marking &amp; Moderation App
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-slate-600 hover:text-slate-900">
              Exams
            </Link>
            <Link
              href="/admin/programmes"
              className="text-slate-600 hover:text-slate-900"
            >
              Programmes
            </Link>
            <Link
              href="/admin/admins"
              className="text-slate-600 hover:text-slate-900"
            >
              Admin users
            </Link>
            <Link
              href="/admin/emails"
              className="text-slate-600 hover:text-slate-900"
            >
              Email log
            </Link>
            <ActingAsPicker
              admins={admins.map((a) => ({ id: a.id, name: a.name }))}
              currentId={current?.id ?? null}
            />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
