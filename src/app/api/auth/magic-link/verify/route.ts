import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const tokenHash = sha256Hex(token);
  const record = await db.verificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.purpose !== "MAGIC_LINK" || record.consumedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", request.url));
  }

  await db.verificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  let user = await db.user.findUnique({ where: { email: record.identifier } });
  const isNewUser = !user;
  if (!user) {
    user = await db.user.create({ data: { email: record.identifier, emailVerifiedAt: new Date() } });
  } else if (!user.emailVerifiedAt) {
    user = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  await createSession(user.id, { ipAddress: await getRequestIp(), userAgent: request.headers.get("user-agent") });
  await recordAuditEvent({ actorUserId: user.id, action: "auth.magic_link_login" });

  return NextResponse.redirect(new URL(isNewUser ? "/onboarding" : "/candidate", request.url));
}
