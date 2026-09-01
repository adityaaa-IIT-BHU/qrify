import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { recordAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const ip = (await getRequestIp()) ?? "unknown";
  const rl = checkRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { email, passwordHash, name } });

  await createSession(user.id, { ipAddress: ip, userAgent: request.headers.get("user-agent") });
  await recordAuditEvent({ actorUserId: user.id, action: "auth.signup", ipAddress: ip });

  // Password accounts start unverified (magic-link/OAuth accounts are
  // verified by construction) — don't block signup on this send succeeding.
  sendVerificationEmail(email).catch((err) => console.error("[signup] verification email failed", err));

  return NextResponse.json({ userId: user.id });
}
