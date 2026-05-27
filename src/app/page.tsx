import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold">Anonymous Grading</h1>
        <p className="mt-2 text-slate-600">
          A tool for distributing exam scripts to markers without revealing
          student identity, then reconciling grades against student CIDs for
          Canvas Gradebook import.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin"
          className="rounded-lg border bg-white p-6 shadow-sm transition hover:border-slate-400"
        >
          <h2 className="text-xl font-semibold">Admin</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create exams, upload seat → CID mappings, assign markers, view all
            data, and export a Canvas Gradebook CSV.
          </p>
        </Link>
        <Link
          href="/marker"
          className="rounded-lg border bg-white p-6 shadow-sm transition hover:border-slate-400"
        >
          <h2 className="text-xl font-semibold">Marker</h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter grades against seat numbers. CIDs are never shown.
          </p>
        </Link>
      </div>
    </div>
  );
}
