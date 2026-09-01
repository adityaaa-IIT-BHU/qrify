import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  const rl = checkRateLimit(`verify-email:${user.id}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });

  await sendVerificationEmail(user.email);
  return NextResponse.json({ ok: true });
}
