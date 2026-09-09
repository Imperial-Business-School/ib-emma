import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { query, queryOne, type Exam } from "@/lib/db";
import { SEAT_ORDER_ASC } from "@/lib/seatSort";

export const dynamic = "force-dynamic";

// Excel template for admins to enter MCQ scores. All three columns
// (Seat number, CID, MCQ score) are pre-formatted as Text ("@") so
// Excel doesn't strip leading zeros from a CID or seat number when
// the admin re-opens the file. Pre-populated with every submission
// on this exam in natural seat order, MCQ score cells left blank
// for the admin to fill in.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const examId = Number(id);
  const exam = Number.isFinite(examId)
    ? await queryOne<Exam>("SELECT name, code FROM exams WHERE id = $1", [
        examId,
      ])
    : null;

  const seats = Number.isFinite(examId)
    ? await query<{ cid: string; seat_number: string }>(
        `SELECT cid, seat_number FROM submissions
         WHERE exam_id = $1
         ORDER BY ${SEAT_ORDER_ASC}`,
        [examId],
      )
    : [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("MCQ scores");
  sheet.columns = [
    { header: "Seat number", key: "seat", width: 15, style: { numFmt: "@" } },
    { header: "CID", key: "cid", width: 15, style: { numFmt: "@" } },
    { header: "MCQ score", key: "mcq", width: 15, style: { numFmt: "@" } },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const s of seats) {
    sheet.addRow({ seat: s.seat_number, cid: s.cid, mcq: "" });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safe = (exam?.code || exam?.name || "mcq")
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_mcq_template.xlsx"`,
    },
  });
}
