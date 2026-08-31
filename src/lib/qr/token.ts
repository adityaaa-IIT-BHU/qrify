import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * QR / apply-link tokens never encode candidate or job data directly (see
 * docs/ARCHITECTURE.md § QR Architecture). The QR image encodes
 * `{APP_URL}/j/{qrTokenId}.{signature}` where `qrTokenId` is the DB primary
 * key (a `cuid`, already high-entropy and unenumerable) and `signature` is
 * an HMAC-SHA256 over that id with a server-only secret.
 *
 * The signature buys us one thing the id alone doesn't: the resolver can
 * reject a tampered/guessed url in O(1), no DB round trip, before it ever
 * touches rate limiting or the database — cheap protection against
 * enumeration probes hammering `/j/*`.
 */

function getSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) throw new Error("QR_TOKEN_SECRET is not set");
  return secret;
}

function sign(qrTokenId: string): string {
  return createHmac("sha256", getSecret()).update(qrTokenId).digest("base64url");
}

export function signQrToken(qrTokenId: string): string {
  return `${qrTokenId}.${sign(qrTokenId)}`;
}

export function verifyQrToken(raw: string): { qrTokenId: string } | null {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const qrTokenId = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);
  const expectedSig = sign(qrTokenId);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { qrTokenId };
}
