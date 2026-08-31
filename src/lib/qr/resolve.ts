import "server-only";
import { db } from "@/lib/db";
import { verifyQrToken } from "@/lib/qr/token";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import type { Job, QRToken } from "@/generated/prisma/client";

export type ResolveQrResult =
  | { ok: true; job: Job; qrToken: QRToken }
  | { ok: false; reason: "invalid_qr" | "rate_limited" | "job_not_accepting_applications" };

export interface ResolveQrRequestMeta {
  ip: string;
  userAgent: string | null;
  referrer: string | null;
  resolvedCandidateUserId?: string;
}

/** Verifies the signed QR token, enforces per-token-per-IP rate limiting, and logs the scan. Shared by the /j/[token] page and the /api/applications/prepare route so both paths agree on what counts as a valid, non-abusive scan. */
export async function resolveQrForRequest(rawToken: string, meta: ResolveQrRequestMeta): Promise<ResolveQrResult> {
  const verified = verifyQrToken(rawToken);
  if (!verified) return { ok: false, reason: "invalid_qr" };

  const ipHash = hashIp(meta.ip, new Date().toISOString().slice(0, 10));
  const rl = checkRateLimit(`scan:${verified.qrTokenId}:${ipHash}`, 20, 60 * 1000);
  if (!rl.allowed) return { ok: false, reason: "rate_limited" };

  const qrToken = await db.qRToken.findUnique({ where: { id: verified.qrTokenId }, include: { job: true } });
  if (!qrToken || qrToken.revoked || (qrToken.expiresAt && qrToken.expiresAt < new Date())) {
    return { ok: false, reason: "invalid_qr" };
  }
  if (qrToken.job.status !== "ACTIVE" || qrToken.job.deletedAt) {
    return { ok: false, reason: "job_not_accepting_applications" };
  }

  await db.qRScan.create({
    data: {
      qrTokenId: qrToken.id,
      ipHash,
      userAgent: meta.userAgent,
      referrer: meta.referrer,
      resolvedCandidateUserId: meta.resolvedCandidateUserId,
    },
  });

  const { job, ...qrTokenFields } = qrToken;
  return { ok: true, job, qrToken: qrTokenFields as QRToken };
}
