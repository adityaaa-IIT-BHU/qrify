import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { getEmailProvider } from "@/lib/email";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Sends (or resends) an email-verification link. Used for password-signup accounts — magic-link and OAuth accounts already have a verified email by construction. */
export async function sendVerificationEmail(email: string): Promise<void> {
  const token = randomToken(32);
  await db.verificationToken.create({
    data: {
      identifier: email,
      tokenHash: sha256Hex(token),
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  const link = `${process.env.APP_URL}/api/auth/verify-email?token=${token}`;
  await getEmailProvider().send({
    to: email,
    subject: "Verify your QRify email",
    html: `<p>Confirm your email to unlock posting jobs on QRify:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
    text: `Verify your email: ${link} (expires in 24 hours)`,
  });
}
