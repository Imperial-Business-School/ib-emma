// Generates an EMMA_BASIC_AUTH entry. Keep ITERATIONS in step with
// src/lib/basicAuth.ts.
//
//   node scripts/basic-auth-credential.mjs e.stoakes@imperial.ac.uk

import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 100_000;

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("usage: node scripts/basic-auth-credential.mjs <email> [password]");
  process.exit(1);
}

const password = process.argv[3] ?? randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");

console.log(`password  ${password}`);
console.log(`entry     ${email}:${salt.toString("base64")}:${hash.toString("base64")}`);
