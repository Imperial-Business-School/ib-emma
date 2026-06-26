import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold">
            IB Anonymous Exam Grading
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="text-slate-600 hover:text-slate-900"
            >
              Exams
            </Link>
            <Link
              href="/admin/emails"
              className="text-slate-600 hover:text-slate-900"
            >
              Email log
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
