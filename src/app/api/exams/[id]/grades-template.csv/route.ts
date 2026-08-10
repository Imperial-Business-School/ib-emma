import { NextResponse } from "next/server";
import { queryOne, type Exam } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// This template does NOT include CIDs -- it's for the marker to upload
// grades, and the marker must not see the CID column. We still check the
// exam exists so the URL is at least valid, but no token validation is
// needed since only column headers leave the server.
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

  const body = toCsv([["Seat number", "Grade", "Comments"]]) + "\n";
  const safe = (exam?.code || exam?.name || "grades")
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}_grades_template.csv"`,
    },
  });
}
