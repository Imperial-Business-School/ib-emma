import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/actor";
import { queryOne, type Exam } from "@/lib/db";
import { finaliseTemplateSheet } from "@/lib/xlsxTemplate";

export const dynamic = "force-dynamic";

// Excel template for the seat/CID upload. The CID column is formatted
// as Text ("@") so typing e.g. 0123456 into a cell keeps its leading
// zero instead of Excel silently reinterpreting it as the number
// 123456. A CSV can't do this — Excel parses digit-only cells as
// numbers regardless of what's in the file — so this endpoint returns
// a real .xlsx workbook. Users can fill it in and then either upload
// the xlsx directly or save it back to CSV; either way the leading
// zero is preserved because the underlying cell value is a string.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await adminAllowed())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const examId = Number(id);
  const exam = Number.isFinite(examId)
    ? await queryOne<Exam>("SELECT name, code FROM exams WHERE id = $1", [
        examId,
      ])
    : null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Seats");
  sheet.columns = [
    { header: "Seat number", key: "seat", width: 15, style: { numFmt: "@" } },
    { header: "CID", key: "cid", width: 15, style: { numFmt: "@" } },
  ];
  finaliseTemplateSheet(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const safe = (exam?.code || exam?.name || "seats")
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_seats_template.xlsx"`,
    },
  });
}
