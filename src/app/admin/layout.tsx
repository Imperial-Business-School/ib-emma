import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold">
            Anonymous Grading
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user && (
              <>
                <span className="text-xs text-slate-500">
                  {user.email}{" "}
                  <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    {user.role}
                  </span>
                </span>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                </form>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </>
  );
}
