import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/employer/jobs?error=missing_token", request.url));

  const tokenHash = sha256Hex(token);
  const record = await db.verificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.purpose !== "EMAIL_VERIFY" || record.consumedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/employer/jobs?error=invalid_or_expired_link", request.url));
  }

  await db.verificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  const user = await db.user.findUnique({ where: { email: record.identifier } });
  if (user && !user.emailVerifiedAt) {
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await db.employer.updateMany({
      where: { members: { some: { userId: user.id } }, verifiedStatus: "UNVERIFIED" },
      data: { verifiedStatus: "EMAIL_VERIFIED" },
    });
    await recordAuditEvent({ actorUserId: user.id, action: "auth.email_verified" });
  }

  return NextResponse.redirect(new URL("/employer/jobs?verified=1", request.url));
}
