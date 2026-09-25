export default function MarkerByTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-8">
      <p
        className="mb-6 text-xs uppercase tracking-wide text-slate-400"
        title="Exam Marking and Moderation System"
      >
        EMMS — Exam Marking and Moderation System
      </p>
      {children}
    </main>
  );
}
