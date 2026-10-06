import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/actor";
import {
  query,
  queryOne,
  type Exam,
  type Submission,
} from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { parseTabularFile } from "@/lib/tabular";
import { computeWeightedGrade } from "@/lib/weighted";

export const dynamic = "force-dynamic";

// POST a Canvas gradebook export (CSV or XLSX). We echo it back as a
// CSV with one extra column -- named after this exam -- carrying each
// student's final grade from EMMS. Canvas strips leading zeros from
// SIS User ID on export, so matching is done against a normalised CID
// (leading zeros removed on both sides).
//
// Response is multipart-ish: JSON with the csv string plus a short
// report so the client can show a summary without re-parsing the file.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await adminAllowed())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return NextResponse.json({ error: "Invalid exam id" }, { status: 400 });
  }

  const exam = await queryOne<Exam>("SELECT * FROM exams WHERE id = $1", [
    examId,
  ]);
  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  if (exam.status !== "complete") {
    return NextResponse.json(
      {
        error:
          "Canvas gradebook is available once every seat has a final grade",
      },
      { status: 409 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "No Canvas gradebook file uploaded" },
      { status: 400 },
    );
  }

  let rows: string[][];
  try {
    rows = await parseTabularFile(file);
  } catch {
    return NextResponse.json(
      { error: "Could not read the uploaded file. Expected a Canvas CSV or XLSX." },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Uploaded file is empty." },
      { status: 400 },
    );
  }

  // Canvas gradebook header row contains Student, ID, SIS User ID,
  // SIS Login ID, Section, then one column per assignment. Find the
  // SIS User ID column case-insensitively.
  const header = rows[0];
  const sisIdx = header.findIndex(
    (c) => c.trim().toLowerCase() === "sis user id",
  );
  const studentIdx = header.findIndex(
    (c) => c.trim().toLowerCase() === "student",
  );
  if (sisIdx < 0) {
    return NextResponse.json(
      {
        error:
          "Uploaded file does not look like a Canvas gradebook export (no 'SIS User ID' column found).",
      },
      { status: 400 },
    );
  }

  const submissions = await query<Submission>(
    `SELECT * FROM submissions WHERE exam_id = $1`,
    [examId],
  );

  // Normalise CIDs to strip leading zeros on numeric strings; non-
  // numeric CIDs (defensive) are kept as-is. Canvas's export drops the
  // leading zero on its SIS User ID column, so matching has to agree
  // on a canonical form.
  const canonical = (s: string): string => {
    const t = s.trim();
    if (!t) return "";
    return /^[0-9]+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t;
  };

  const byCanonicalCid = new Map<
    string,
    { grade: string | null; absent: boolean; cid: string }
  >();
  for (const s of submissions) {
    const key = canonical(s.cid);
    if (key) {
      byCanonicalCid.set(key, {
        grade: s.absent
          ? null
          : (computeWeightedGrade(
              s.final_grade,
              s.mcq_score,
              exam.mcq_weighting,
              exam.mcq_enabled,
            ) ?? s.final_grade),
        absent: s.absent,
        cid: s.cid,
      });
    }
  }

  // Build the output row-by-row. Preserve every column in Canvas's
  // header, add our exam column at the end. Metadata rows (any row
  // whose SIS User ID is blank — e.g. the "Points Possible" line
  // Canvas inserts between header and data) get a blank in the new
  // column so Canvas's import ignores them for our new assignment.
  const assignmentHeader = exam.name;
  const out: string[][] = [];
  out.push([...header, assignmentHeader]);

  let gradesWritten = 0;
  const matchedCanonicalCids = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sisRaw = (row[sisIdx] ?? "").trim();
    if (!sisRaw) {
      // Metadata row (Points Possible, Muted, etc.) — passthrough,
      // blank in our column.
      out.push([...row, ""]);
      continue;
    }
    const key = canonical(sisRaw);
    const match = byCanonicalCid.get(key);
    if (!match) {
      // Student in Canvas but not in this EMMS exam — passthrough,
      // blank in our column.
      out.push([...row, ""]);
      continue;
    }
    matchedCanonicalCids.add(key);
    if (match.absent) {
      // Absent in EMMS → blank cell per spec; Canvas keeps whatever is
      // already there (or nothing).
      out.push([...row, ""]);
    } else if (match.grade == null) {
      out.push([...row, ""]);
    } else {
      out.push([...row, String(match.grade)]);
      gradesWritten++;
    }
  }

  // CIDs in EMMS that didn't appear in the uploaded Canvas export.
  // These likely mean a Canvas enrollment issue the admin needs to
  // resolve. Report by seat_number for traceability.
  const unmatched: Array<{ seat_number: string; cid: string }> = [];
  for (const s of submissions) {
    if (s.absent) continue;
    const key = canonical(s.cid);
    if (!matchedCanonicalCids.has(key)) {
      unmatched.push({ seat_number: s.seat_number, cid: s.cid });
    }
  }

  const csv = "﻿" + toCsv(out) + "\n";
  const safeName = (exam.code || exam.name)
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .slice(0, 60);
  const filename = `${safeName}_canvas_upload.csv`;

  return NextResponse.json({
    csv,
    filename,
    report: {
      assignmentHeader,
      gradesWritten,
      unmatched,
      // We silently passthrough metadata and non-exam students; the
      // client just needs the actionable numbers.
      canvasRowCount: rows.length - 1,
      studentColumnFound: studentIdx >= 0,
    },
  });
}
