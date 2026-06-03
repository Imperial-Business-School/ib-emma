import { NextResponse } from "next/server";
import {
  EXAM_STATUS_LABEL,
  query,
  queryOne,
  type Exam,
  type Submission,
  type User,
} from "@/lib/db";
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
    "SELECT * FROM submissions WHERE exam_id = $1 ORDER BY length(seat_number), seat_number",
    [examId],
  );

  const primary = exam.primary_marker_id
    ? await queryOne<User>("SELECT * FROM users WHERE id = $1", [
        exam.primary_marker_id,
      ])
    : null;
  const secondary = exam.secondary_marker_id
    ? await queryOne<User>("SELECT * FROM users WHERE id = $1", [
        exam.secondary_marker_id,
      ])
    : null;

  const meta = [
    ["# Exam", exam.name],
    ["# Code", exam.code ?? ""],
    ["# Status", EXAM_STATUS_LABEL[exam.status]],
    ["# Sampling mode", exam.sampling_mode],
    ["# Created at", exam.created_at],
    ["# Primary completed at", exam.primary_completed_at ?? ""],
    ["# Secondary completed at", exam.secondary_completed_at ?? ""],
    [
      "# Primary marker",
      primary ? `${primary.name ?? ""} <${primary.email}>` : "",
    ],
    [
      "# Secondary marker",
      secondary ? `${secondary.name ?? ""} <${secondary.email}>` : "",
    ],
    [""],
  ];

  const header = [
    "Seat",
    "CID",
    "In sample",
    "Primary grade",
    "Primary comment",
    "Primary graded at",
    "Secondary grade",
    "Secondary comment",
    "Secondary graded at",
    "Final grade",
    "Final marker comment",
    "Final graded at",
  ];

  const rows: (string | number | null)[][] = [...meta, header];
  for (const s of submissions) {
    rows.push([
      s.seat_number,
      s.cid,
      s.in_sample ? "Yes" : "No",
      s.grade,
      s.primary_comment,
      s.graded_at,
      s.secondary_grade,
      s.secondary_comment,
      s.secondary_graded_at,
      s.final_grade,
      s.final_comment,
      s.final_graded_at,
    ]);
  }

  const body = toCsv(rows) + "\n";
  const safeName = (exam.code || exam.name)
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  const filename = `${safeName}_audit.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
