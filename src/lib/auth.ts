import { query, queryOne, type User } from "@/lib/db";

// The app no longer requires login. This module survives only as a place to
// create user rows for primary/secondary markers so we have an email/name to
// display on the admin exam page.
export async function findOrCreateUser(
  email: string,
  name: string | null,
): Promise<User> {
  const normalized = email.trim().toLowerCase();
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
    return existing;
  }
  const created = await queryOne<User>(
    "INSERT INTO users (email, name, role) VALUES ($1, $2, 'marker') RETURNING *",
    [normalized, name],
  );
  if (!created) throw new Error("Failed to create user");
  return created;
}
