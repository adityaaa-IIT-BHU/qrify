import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Field-level encryption for secrets we must persist but never expose raw —
 * currently OAuth access/refresh tokens (OAuthConnection.accessTokenEnc /
 * refreshTokenEnc). AES-256-GCM: random 12-byte IV per value, auth tag
 * appended, everything base64-joined as `iv:tag:ciphertext`.
 *
 * ENCRYPTION_KEY must be a base64-encoded 32-byte key (`openssl rand -base64 32`).
 * Rotating it invalidates every previously-encrypted value — see docs/SECURITY.md.
 */

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** One-way hash for values we only ever need to compare (session/verification tokens). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Cryptographically random URL-safe opaque token (session cookies, magic links). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hashes an IP address with a server-side salt for QRScan analytics — never
 * store raw IPs. Daily bucketing (via caller-supplied `bucket`, e.g. the
 * current date) keeps hashes non-correlatable across days.
 */
export function hashIp(ip: string, bucket: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return sha256Hex(`${salt}:${bucket}:${ip}`);
}
