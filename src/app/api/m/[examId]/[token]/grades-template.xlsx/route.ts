import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { query, queryOne, type Exam } from "@/lib/db";
import { SEAT_ORDER_ASC } from "@/lib/seatSort";
import { computeWeightedGrade } from "@/lib/weighted";

export const dynamic = "force-dynamic";

// Token-scoped grades template.
//
// First marker: every non-absent seat, columns Seat number / Grade /
// Feedback (with an MCQ score reference column inserted when the exam
// has MCQ enabled). The first marker leaves Feedback; the second
// marker leaves Comments.
//
// Second marker: only the seats in their assigned sample, columns
// Seat number / First Marker's grade / First Marker's feedback /
// Second Marker grade / Comments (with an MCQ score reference
// column inserted when the exam has MCQ enabled). The first marker's
// grade and feedback columns are populated for reference so the second
// marker can weigh both while filling in their own grade.
//
// All numeric-looking columns (Seat number, MCQ score, grades) are
// formatted as Text ("@") so Excel doesn't strip a leading zero from
// e.g. "0123456" or reinterpret "05" as the number 5. CIDs are never
// included on the marker template.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ examId: string; token: string }> },
) {
  const { examId: rawId, token } = await params;
  const examId = Number(rawId);
  if (!Number.isFinite(examId) || !token) notFound();

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) notFound();

  let role: "primary" | "secondary";
  if (token === exam.primary_access_token) role = "primary";
  else if (token === exam.secondary_access_token) role = "secondary";
  else notFound();

  const safe = (exam.code || exam.name || "grades")
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);

  const mcqEnabled = exam.mcq_enabled;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Grades");
  const textCol = { style: { numFmt: "@" }, width: 15 };

  if (role === "secondary") {
    const seats = await query<{
      seat_number: string;
      grade: string | null;
      primary_comment: string | null;
      mcq_score: string | null;
    }>(
      `SELECT seat_number, grade, primary_comment, mcq_score FROM submissions
       WHERE exam_id = $1 AND in_sample = true AND absent = false
       ORDER BY ${SEAT_ORDER_ASC}`,
      [examId],
    );
    sheet.columns = [
      { header: "Seat number", key: "seat", ...textCol },
      ...(mcqEnabled
        ? [{ header: "MCQ score", key: "mcq", ...textCol }]
        : []),
      { header: "First Marker's grade", key: "primary_grade", ...textCol },
      // Weighted score column is populated for reference only.
      // The upload parser skips any column matching /(first|primary)/i,
      // so anything the second marker types here is ignored on upload
      // -- the web view always recomputes the weighted score from the
      // saved DB grades. Only included when MCQ is enabled; without
      // MCQ the weighted score is just the grade, so the column has
      // no extra information.
      ...(mcqEnabled
        ? [
            {
              header: "First marker's Weighted Score",
              key: "primary_weighted",
              ...textCol,
            },
          ]
        : []),
      {
        header: "First Marker's feedback",
        key: "primary_feedback",
        width: 40,
      },
      { header: "Second Marker grade", key: "grade", ...textCol },
      { header: "Comments", key: "comment", width: 40 },
    ];
    for (const s of seats) {
      const primaryWeighted = mcqEnabled
        ? (computeWeightedGrade(
            s.grade,
            s.mcq_score,
            exam.mcq_weighting,
            true,
          ) ?? "")
        : "";
      sheet.addRow(
        mcqEnabled
          ? {
              seat: s.seat_number,
              mcq: s.mcq_score ?? "",
              primary_grade: s.grade ?? "",
              primary_weighted: primaryWeighted,
              primary_feedback: s.primary_comment ?? "",
              grade: "",
              comment: "",
            }
          : {
              seat: s.seat_number,
              primary_grade: s.grade ?? "",
              primary_feedback: s.primary_comment ?? "",
              grade: "",
              comment: "",
            },
      );
    }
  } else {
    const seats = await query<{
      seat_number: string;
      mcq_score: string | null;
    }>(
      `SELECT seat_number, mcq_score FROM submissions
       WHERE exam_id = $1 AND absent = false
       ORDER BY ${SEAT_ORDER_ASC}`,
      [examId],
    );
    sheet.columns = [
      { header: "Seat number", key: "seat", ...textCol },
      ...(mcqEnabled
        ? [{ header: "MCQ score", key: "mcq", ...textCol }]
        : []),
      { header: "Grade", key: "grade", ...textCol },
      { header: "Feedback", key: "comment", width: 40 },
    ];
    for (const s of seats) {
      sheet.addRow(
        mcqEnabled
          ? {
              seat: s.seat_number,
              mcq: s.mcq_score ?? "",
              grade: "",
              comment: "",
            }
          : { seat: s.seat_number, grade: "", comment: "" },
      );
    }
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_grades_template.xlsx"`,
    },
  });
}
