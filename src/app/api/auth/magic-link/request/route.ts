import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { getEmailProvider } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/auth/session";

const RequestSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const TTL_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email } = parsed.data;

  const ip = (await getRequestIp()) ?? "unknown";
  const rl = checkRateLimit(`magic-link:${email}`, 5, 15 * 60 * 1000);
  const rlIp = checkRateLimit(`magic-link:ip:${ip}`, 20, 15 * 60 * 1000);

  // Always respond the same way regardless of rate-limit or account existence — avoids leaking
  // account existence and, for the rate-limited case, avoids revealing that this specific address
  // was targeted repeatedly.
  if (rl.allowed && rlIp.allowed) {
    const token = randomToken(32);
    await db.verificationToken.create({
      data: {
        identifier: email,
        tokenHash: sha256Hex(token),
        purpose: "MAGIC_LINK",
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });

    const link = `${process.env.APP_URL}/api/auth/magic-link/verify?token=${token}`;
    await getEmailProvider().send({
      to: email,
      subject: "Your QRify sign-in link",
      html: `<p>Click to sign in to QRify — this link expires in 15 minutes:</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      text: `Sign in to QRify: ${link} (expires in 15 minutes)`,
    });
  }

  return NextResponse.json({ ok: true, message: "If that email has an account, a sign-in link is on its way." });
}
