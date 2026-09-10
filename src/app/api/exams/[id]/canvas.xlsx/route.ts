import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/actor";
import {
  query,
  queryOne,
  type Exam,
  type Submission,
} from "@/lib/db";
import { computeWeightedGrade } from "@/lib/weighted";
import { finaliseTemplateSheet } from "@/lib/xlsxTemplate";

export const dynamic = "force-dynamic";

// Canvas Gradebook Import accepts .xlsx as well as .csv. XLSX lets us
// pin the SIS User ID column to Text ("@") so Excel does not strip
// the leading zero from a CID like "0123456" when the admin opens the
// file to review before uploading. A CSV cannot express that
// per-column formatting; Excel decides the type at open time and
// digit-only cells become numbers, silently dropping the leading zero
// that Canvas requires. XLSX bypasses that entirely.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await adminAllowed())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return new NextResponse("Invalid exam id", { status: 400 });
  }

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) return new NextResponse("Exam not found", { status: 404 });
  if (exam.status !== "complete") {
    return new NextResponse(
      "Canvas gradebook is available once every seat has a final grade",
      { status: 409 },
    );
  }

  const submissions = await query<Submission>(
    `SELECT * FROM submissions
     WHERE exam_id = $1 AND absent = false AND final_grade IS NOT NULL
     ORDER BY cid`,
    [examId],
  );

  const textCol = { style: { numFmt: "@" }, width: 15 };
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Gradebook");
  sheet.columns = [
    { header: "Student", key: "student", width: 20 },
    { header: "ID", key: "id", ...textCol },
    { header: "SIS User ID", key: "sis_user_id", ...textCol },
    { header: "SIS Login ID", key: "sis_login_id", ...textCol },
    { header: "Section", key: "section", width: 15 },
    { header: exam.name, key: "grade", ...textCol },
  ];

  for (const s of submissions) {
    // Where MCQ is enabled we export the weighted grade; otherwise the
    // final grade. Falls back to final grade if either input is missing.
    const gradeForCanvas = computeWeightedGrade(
      s.final_grade,
      s.mcq_score,
      exam.mcq_weighting,
      exam.mcq_enabled,
    );
    sheet.addRow({
      student: "",
      id: "",
      sis_user_id: s.cid,
      sis_login_id: "",
      section: "",
      grade: gradeForCanvas ?? "",
    });
  }

  finaliseTemplateSheet(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = (exam.code || exam.name)
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  const filename = `${safeName}_canvas_gradebook.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
