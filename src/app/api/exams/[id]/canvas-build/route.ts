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

// POST a Canvas gradebook export (CSV or XLSX). We emit a Canvas-import-
// ready CSV in exactly this column order:
//
//   Student | ID | SIS User ID | SIS Login ID | Integration ID | Section | <Exam name>
//
// Every other column in the uploaded file (other assignments, Final
// Grade, Current Score, etc.) is dropped. The last column is the exam
// name, populated with each student's weighted final grade from EMMS so
// Canvas treats this upload as a single-assignment import -- no "This
// is a new assignment / Bogus, ignore it" prompt. Canvas strips the
// leading zero from SIS User ID on export, so matching is done on a
// canonical form (leading zeros stripped on both sides).
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
      {
        error:
          "Could not read the uploaded file. Expected a Canvas CSV or XLSX.",
      },
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
  // SIS Login ID, Integration ID, Section, plus one column per
  // assignment. Find each of the six identifier columns we care about;
  // any missing one is tolerated (emitted blank in the output).
  const header = rows[0];
  const findCol = (label: string): number =>
    header.findIndex((c) => c.trim().toLowerCase() === label.toLowerCase());
  const idx = {
    student: findCol("Student"),
    id: findCol("ID"),
    sisUserId: findCol("SIS User ID"),
    sisLoginId: findCol("SIS Login ID"),
    integrationId: findCol("Integration ID"),
    section: findCol("Section"),
  };
  if (idx.sisUserId < 0) {
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
  // numeric CIDs are kept as-is. Canvas's export drops the leading
  // zero on its SIS User ID column, so matching has to agree on a
  // canonical form.
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

  const assignmentHeader = exam.name;
  const outHeader = [
    "Student",
    "ID",
    "SIS User ID",
    "SIS Login ID",
    "Integration ID",
    "Section",
    assignmentHeader,
  ];

  // Pull cell by column name, blank if the input didn't have that
  // column at all.
  const pick = (row: string[], i: number): string =>
    i < 0 ? "" : (row[i] ?? "").toString();

  const out: string[][] = [outHeader];
  let gradesWritten = 0;
  const matchedCanonicalCids = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sisRaw = pick(row, idx.sisUserId).trim();

    // Metadata rows (blank SIS User ID) -- Points Possible, Muted,
    // or Canvas's one-blank-row separator between header and data.
    // Preserve the Student cell (so "Points Possible" survives) and
    // leave the rest blank, including the grade column.
    if (!sisRaw) {
      const student = pick(row, idx.student);
      // A completely blank row stays completely blank.
      const isBlankRow = row.every(
        (c) => (c ?? "").toString().trim() === "",
      );
      if (isBlankRow) {
        out.push(["", "", "", "", "", "", ""]);
      } else {
        out.push([student, "", "", "", "", "", ""]);
      }
      continue;
    }

    // Data row -- emit the six Canvas identifier columns and try to
    // match the student to an EMMS seat for the grade column.
    const base = [
      pick(row, idx.student),
      pick(row, idx.id),
      sisRaw,
      pick(row, idx.sisLoginId),
      pick(row, idx.integrationId),
      pick(row, idx.section),
    ];
    const key = canonical(sisRaw);
    const match = byCanonicalCid.get(key);
    if (!match || match.absent || match.grade == null) {
      // Canvas student with no EMMS match / absent / ungraded -> blank.
      out.push([...base, ""]);
    } else {
      out.push([...base, String(match.grade)]);
      gradesWritten++;
    }
    if (match) matchedCanonicalCids.add(key);
  }

  // CIDs in EMMS that didn't appear in the uploaded Canvas export --
  // most likely a Canvas enrollment issue. Listed by seat_number so
  // the admin can trace them back.
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
      canvasRowCount: rows.length - 1,
      studentColumnFound: idx.student >= 0,
    },
  });
}
