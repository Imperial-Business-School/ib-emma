export default function MarkerByTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="mb-6 text-xs uppercase tracking-wide text-slate-400">
        Anonymous Grading
      </p>
      {children}
    </main>
  );
}
