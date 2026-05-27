import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "cid-seat.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      seat_number TEXT NOT NULL,
      cid TEXT NOT NULL,
      grade TEXT,
      graded_at TEXT,
      UNIQUE(exam_id, seat_number),
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id);
  `);
}

export const db: Database.Database =
  global.__db ??
  (() => {
    const d = new Database(dbPath);
    init(d);
    global.__db = d;
    return d;
  })();

export type Exam = {
  id: number;
  name: string;
  code: string | null;
  created_at: string;
};

export type Submission = {
  id: number;
  exam_id: number;
  seat_number: string;
  cid: string;
  grade: string | null;
  graded_at: string | null;
};
