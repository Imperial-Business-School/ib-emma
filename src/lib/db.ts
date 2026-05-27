import { Pool, type QueryResultRow } from "pg";

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
  `);
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

export type Role = "admin" | "marker";

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  created_at: string;
  last_login_at: string | null;
};
