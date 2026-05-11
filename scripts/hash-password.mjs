import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <admin-password>");
  process.exit(1);
}

const iterations = 150_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const b64url = (buffer) => Buffer.from(buffer).toString("base64url");
console.log(`pbkdf2-sha256$${iterations}$${b64url(salt)}$${b64url(hash)}`);
