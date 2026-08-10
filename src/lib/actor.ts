// Cookie-based "acting as" admin identity for the audit trail. Bridge
// until real authentication ships -- swap this module out then.

import { cookies } from "next/headers";
import { query, queryOne, type Admin } from "@/lib/db";

const COOKIE = "emma_actor_id";

// Reads the acting admin from the cookie. Touches last_access_at when
// found so the Admin users table shows recent activity. Falls back to
// the first admin if the cookie is missing / stale.
export async function getActingAdmin(): Promise<Admin | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const id = raw ? Number(raw) : NaN;

  if (Number.isFinite(id)) {
    const found = await queryOne<Admin>(
      "SELECT * FROM admins WHERE id = $1",
      [id],
    );
    if (found) {
      // Fire and forget; don't hold up the page render.
      query(
        "UPDATE admins SET last_access_at = now() WHERE id = $1",
        [found.id],
      ).catch(() => {});
      return found;
    }
  }

  // Fallback to the first admin so the header dropdown always renders
  // something sensible on first visit.
  return (
    (await queryOne<Admin>(
      "SELECT * FROM admins ORDER BY id LIMIT 1",
    )) ?? null
  );
}

export async function getAllAdmins(): Promise<Admin[]> {
  return await query<Admin>("SELECT * FROM admins ORDER BY name");
}

export async function setActingAdminCookie(id: number): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, String(id), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
