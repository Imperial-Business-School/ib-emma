import { Pool, type QueryResultRow } from "pg";
import crypto from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __initPromise: Promise<void> | undefined;
}

function getConnectionString(): string {
  const url =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    throw new Error(
      "No Postgres connection string. Set POSTGRES_URL or DATABASE_URL.",
    );
  }
  return url;
}

function getPool(): Pool {
  if (!global.__pool) {
    const connectionString = getConnectionString();
    // Many hosted Postgres providers (Neon, Supabase, RDS) require SSL.
    const needsSsl =
      /sslmode=require/i.test(connectionString) ||
      /neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString);
    global.__pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return global.__pool;
}

async function initSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      seat_number TEXT NOT NULL,
      cid TEXT NOT NULL,
      grade TEXT,
      graded_at TIMESTAMPTZ,
      UNIQUE (exam_id, seat_number)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id);

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'marker' CHECK (role IN ('admin','marker')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS exam_markers (
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (exam_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_exam_markers_user ON exam_markers(user_id);

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);

    -- Two-marker workflow additions.
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'setup';
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_marker_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_marker_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_completed_at TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_completed_at TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_access_token TEXT;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_access_token TEXT;

    ALTER TABLE exams ADD COLUMN IF NOT EXISTS sampling_mode TEXT NOT NULL DEFAULT 'standard';
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_deadline TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_deadline TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_overdue_notified_at TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS primary_late_notified_at TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_overdue_notified_at TIMESTAMPTZ;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS secondary_late_notified_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
    CREATE INDEX IF NOT EXISTS idx_exams_created_at ON exams(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_exams_name_lower ON exams(lower(name));
    CREATE INDEX IF NOT EXISTS idx_exams_code_lower ON exams(lower(code));

    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS secondary_grade TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS secondary_graded_at TIMESTAMPTZ;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS in_sample BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_grade TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS primary_comment TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS secondary_comment TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_comment TEXT;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_graded_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS email_log (
      id BIGSERIAL PRIMARY KEY,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      recipient TEXT NOT NULL,
      cc TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      urgent BOOLEAN NOT NULL DEFAULT false,
      exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL,
      kind TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'stub'
    );
    CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(lower(recipient));
    CREATE INDEX IF NOT EXISTS idx_email_log_exam ON email_log(exam_id);
  `);

  // Backfill access tokens for exams created before the URL-share workflow.
  const missing = await pool.query<{ id: number }>(
    "SELECT id FROM exams WHERE primary_access_token IS NULL OR secondary_access_token IS NULL",
  );
  for (const row of missing.rows) {
    await pool.query(
      `UPDATE exams
       SET primary_access_token = COALESCE(primary_access_token, $2),
           secondary_access_token = COALESCE(secondary_access_token, $3)
       WHERE id = $1`,
      [row.id, randomToken(), randomToken()],
    );
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_primary_token ON exams(primary_access_token);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_secondary_token ON exams(secondary_access_token);
  `);
}

export function randomToken(): string {
  // 16 bytes = 32 hex chars, ~128 bits of entropy
  return crypto.randomBytes(16).toString("hex");
}

async function ensureReady(): Promise<void> {
  if (!global.__initPromise) {
    global.__initPromise = initSchema().catch((err) => {
      global.__initPromise = undefined;
      throw err;
    });
  }
  return global.__initPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureReady();
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export type { ExamStatus, SamplingMode } from "./examStatus";
export { EXAM_STATUS_LABEL } from "./examStatus";
import type { ExamStatus, SamplingMode } from "./examStatus";

export type Exam = {
  id: number;
  name: string;
  code: string | null;
  created_at: string;
  status: ExamStatus;
  sampling_mode: SamplingMode;
  primary_marker_id: number | null;
  secondary_marker_id: number | null;
  primary_completed_at: string | null;
  secondary_completed_at: string | null;
  primary_access_token: string | null;
  secondary_access_token: string | null;
  primary_deadline: string | null;
  secondary_deadline: string | null;
  primary_overdue_notified_at: string | null;
  primary_late_notified_at: string | null;
  secondary_overdue_notified_at: string | null;
  secondary_late_notified_at: string | null;
};

export type Submission = {
  id: number;
  exam_id: number;
  seat_number: string;
  cid: string;
  grade: string | null;
  graded_at: string | null;
  primary_comment: string | null;
  secondary_grade: string | null;
  secondary_graded_at: string | null;
  secondary_comment: string | null;
  in_sample: boolean;
  final_grade: string | null;
  final_comment: string | null;
  final_graded_at: string | null;
};

export { GRADE_REGEX, GRADE_REGEX_SOURCE, isValidGrade } from "./validation";

export type Role = "admin" | "marker";

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
  last_login_at: string | null;
};

export type EmailLog = {
  id: number;
  sent_at: string;
  recipient: string;
  cc: string | null;
  subject: string;
  body: string;
  urgent: boolean;
  exam_id: number | null;
  kind: string | null;
  delivery_status: string;
};
