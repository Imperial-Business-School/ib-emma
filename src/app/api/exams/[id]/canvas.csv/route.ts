import { NextResponse } from "next/server";
import { query, queryOne, type Exam, type Submission } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return new NextResponse("Invalid exam id", { status: 400 });
  }

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) return new NextResponse("Exam not found", { status: 404 });

  const submissions = await query<Submission>(
    `SELECT * FROM submissions
     WHERE exam_id = $1 AND grade IS NOT NULL
     ORDER BY cid`,
    [examId],
  );

  // Canvas Gradebook import format. Canvas matches students by SIS User ID
  // (the CID at Imperial). The other ID columns can be blank. The assignment
  // column header should match the assignment name in Canvas.
  const assignmentColumn = exam.code ? `${exam.code} — ${exam.name}` : exam.name;

  const header = [
    "Student",
    "ID",
    "SIS User ID",
    "SIS Login ID",
    "Section",
    assignmentColumn,
  ];
  const rows: (string | number | null)[][] = [header];
  for (const s of submissions) {
    rows.push(["", "", s.cid, "", "", s.grade]);
  }

  const body = toCsv(rows) + "\n";
  const safeName = (exam.code || exam.name)
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  const filename = `${safeName}_canvas_gradebook.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
