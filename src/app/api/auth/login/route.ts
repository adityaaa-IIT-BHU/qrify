import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const ip = (await getRequestIp()) ?? "unknown";
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Rate-limit by email (brute force) as well as by IP (credential stuffing across many accounts).
  const byEmail = checkRateLimit(`login:email:${email}`, 8, 15 * 60 * 1000);
  const byIp = checkRateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!byEmail.allowed || !byIp.allowed) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.deletedAt) {
    // Same generic error whether the account doesn't exist or has no password set (OAuth-only) — avoid user enumeration.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id, { ipAddress: ip, userAgent: request.headers.get("user-agent") });
  await recordAuditEvent({ actorUserId: user.id, action: "auth.login", ipAddress: ip });

  return NextResponse.json({ userId: user.id });
}
