import Link from "next/link";
import {
  ACADEMIC_YEARS,
  DEFAULT_ACADEMIC_YEAR,
  query,
  type Programme,
} from "@/lib/db";
import { CreateExamForm } from "../../admin/CreateExamForm";

export const dynamic = "force-dynamic";

export default async function CreateExamPage() {
  const programmes = await query<Programme>(
    "SELECT * FROM programmes ORDER BY lower(name)",
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/exams"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to all exams
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Create exam</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter both markers, pick a sampling mode, and (if applicable) enable
          the MCQ element. The sampling mode is locked once primary marking
          starts.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <CreateExamForm
          programmes={programmes.map((p) => ({
            id: p.id,
            name: p.name,
            programme_id: p.programme_id,
            level: p.level,
          }))}
          academicYears={[...ACADEMIC_YEARS]}
          defaultAcademicYear={DEFAULT_ACADEMIC_YEAR}
        />
      </section>
    </div>
  );
}
