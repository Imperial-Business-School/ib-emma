import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Anonymous Grading",
  description: "CID-seat anonymous grading tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              Anonymous Grading
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                href="/admin"
                className="text-slate-600 hover:text-slate-900"
              >
                Admin
              </Link>
              <Link
                href="/marker"
                className="text-slate-600 hover:text-slate-900"
              >
                Marker
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
