// Interim perimeter for while Entra app registrations are unavailable.
// EMMA_BASIC_AUTH holds one entry per admin, separated by whitespace or
// commas: email:saltBase64:hashBase64. Generate entries with
// scripts/basic-auth-credential.mjs.
//
// Runs in middleware, so this file must stay edge-safe: Web Crypto only,
// no node: imports.

// Passwords are generated, not chosen, so the iteration count only has to
// make offline cracking impractical rather than defeat a dictionary. Kept
// low enough that verifying on every request stays imperceptible.
const ITERATIONS = 100_000;

export function basicAuthEnabled(): boolean {
  return Boolean(process.env.EMMA_BASIC_AUTH?.trim());
}

// The username from a Basic header, for callers that have already been
// through the middleware and only need to know who the request is from.
export function basicAuthUser(header: string | null): string | null {
  return parse(header)?.email ?? null;
}

export async function verifyBasicAuth(header: string | null): Promise<boolean> {
  const given = parse(header);
  if (!given) return false;

  const stored = credentials().get(given.email);
  if (!stored) return false;

  return equal(await derive(given.password, stored.salt), stored.hash);
}

// atob decodes Latin-1, which is fine for addresses and for the base64url
// passwords the generator produces.
function parse(header: string | null): { email: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;

  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return null;
  }

  const split = decoded.indexOf(":");
  if (split < 0) return null;

  return {
    email: decoded.slice(0, split).trim().toLowerCase(),
    password: decoded.slice(split + 1),
  };
}

function credentials() {
  const entries = new Map<string, { salt: BufferSource; hash: Uint8Array }>();

  for (const entry of (process.env.EMMA_BASIC_AUTH ?? "").split(/[\s,]+/)) {
    const [email, salt, hash] = entry.split(":");
    if (!email || !salt || !hash) continue;
    entries.set(email.toLowerCase(), { salt: bytes(salt), hash: bytes(hash) });
  }

  return entries;
}

async function derive(password: string, salt: BufferSource): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function bytes(base64: string) {
  const binary = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
