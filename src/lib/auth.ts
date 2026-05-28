import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { query, queryOne, type Role, type User } from "@/lib/db";

const SESSION_COOKIE = "cidseat_session";
const SESSION_TTL_DAYS = 30;
const TOKEN_TTL_MINUTES = 30;

function getSessionSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET env var must be set to a string of at least 32 chars",
    );
  }
  return new TextEncoder().encode(s);
}

export function getAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "r.banks@imperial.ac.uk";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return getAdminAllowlist().includes(email.trim().toLowerCase());
}

export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type SessionPayload = {
  sub: string;
  email: string;
  role: Role;
};

export async function createSessionCookie(user: User): Promise<void> {
  const token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getSessionSecret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function readSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const c = jar.get(SESSION_COOKIE);
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c.value, getSessionSecret());
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      role: payload.role === "admin" ? "admin" : "marker",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await readSessionPayload();
  if (!session) return null;
  const userId = Number(session.sub);
  if (!Number.isFinite(userId)) return null;
  return (
    (await queryOne<User>("SELECT * FROM users WHERE id = $1", [userId])) ??
    null
  );
}

export type MarkerRole = "primary" | "secondary";

export async function getMarkerRoleForExam(
  userId: number,
  examId: number,
): Promise<MarkerRole | null> {
  const row = await queryOne<{
    primary_marker_id: number | null;
    secondary_marker_id: number | null;
  }>(
    "SELECT primary_marker_id, secondary_marker_id FROM exams WHERE id = $1",
    [examId],
  );
  if (!row) return null;
  if (row.primary_marker_id === userId) return "primary";
  if (row.secondary_marker_id === userId) return "secondary";
  return null;
}

export async function canMarkExam(
  userId: number,
  examId: number,
): Promise<boolean> {
  return (await getMarkerRoleForExam(userId, examId)) !== null;
}

// Magic-link tokens
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function createMagicLinkToken(userId: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
  await query(
    "INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hash, userId, expires.toISOString()],
  );
  return raw;
}

export async function consumeMagicLinkToken(
  raw: string,
): Promise<User | null> {
  const hash = hashToken(raw);
  const row = await queryOne<{
    token_hash: string;
    user_id: number;
    expires_at: string;
    consumed_at: string | null;
  }>("SELECT * FROM auth_tokens WHERE token_hash = $1", [hash]);
  if (!row) return null;
  if (row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(
    "UPDATE auth_tokens SET consumed_at = now() WHERE token_hash = $1",
    [hash],
  );

  const user = await queryOne<User>("SELECT * FROM users WHERE id = $1", [
    row.user_id,
  ]);
  if (!user) return null;

  // Re-evaluate admin allowlist on each login so promotions take effect.
  if (isAdminEmail(user.email) && user.role !== "admin") {
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
    user.role = "admin";
  }
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [
    user.id,
  ]);
  return user;
}

// User upsert helpers
export async function findOrCreateUser(
  email: string,
  name: string | null,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const role: Role = isAdminEmail(normalized) ? "admin" : "marker";
  const existing = await queryOne<User>(
    "SELECT * FROM users WHERE email = $1",
    [normalized],
  );
  if (existing) {
    if (name && !existing.name) {
      await query("UPDATE users SET name = $1 WHERE id = $2", [
        name,
        existing.id,
      ]);
      existing.name = name;
    }
    if (role === "admin" && existing.role !== "admin") {
      await query("UPDATE users SET role = 'admin' WHERE id = $1", [
        existing.id,
      ]);
      existing.role = "admin";
    }
    return existing;
  }
  const created = await queryOne<User>(
    "INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING *",
    [normalized, name, role],
  );
  if (!created) throw new Error("Failed to create user");
  return created;
}

// Returns existing user only — does NOT create. Used by login page so that
// unknown emails don't auto-provision accounts.
export async function findLoginEligibleUser(
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const existing = await queryOne<User>(
    "SELECT * FROM users WHERE email = $1",
    [normalized],
  );
  if (existing) return existing;
  // Admins in the allowlist can self-provision on first login.
  if (isAdminEmail(normalized)) {
    return findOrCreateUser(normalized, null);
  }
  return null;
}
